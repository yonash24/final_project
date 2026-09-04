import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';

import { getCachedChatResponse, cacheChatResponse } from '@/lib/ai/chat-cache';
import { getChatResponse } from '@/lib/ai/chat-service';
import { type ChatMessage } from '@/lib/ai/intent-classifier';
import { recordChatInsight, recordChatMetric } from '@/lib/observability/audit';
import { DataSourceUnavailableError } from '@/lib/db/data-source';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;
const chatRequestSchema = z.object({
    message: z.string().trim().min(1).max(500),
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(500) })).max(20).default([]),
});

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) return false;
    entry.count += 1;
    return true;
}

export async function POST(request: NextRequest) {
    const requestStartedAt = performance.now();
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        if (!checkRateLimit(ip)) {
            return Response.json({ error: 'יותר מדי בקשות. נסה שוב בעוד דקה.' }, { status: 429 });
        }

        const parsed = chatRequestSchema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: 'נא לשלוח הודעה תקינה וקצרה.' }, { status: 400 });
        const { message } = parsed.data;
        const normalizedHistory: ChatMessage[] = parsed.data.history.slice(-8);

        if (normalizedHistory.length === 0) {
            const cached = await getCachedChatResponse(message);
            if (cached) {
                void recordChatMetric({
                    requestId,
                    intent: cached.intent,
                    responseType: cached.responseType,
                    totalDurationMs: Math.round(performance.now() - requestStartedAt),
                    resultCount: cached.resultCount,
                    cacheHit: true,
                });
                return Response.json(cached, { headers: { 'x-request-id': requestId, 'x-chat-cache': 'hit' } });
            }
        }

        const response = await getChatResponse(message, normalizedHistory);

        console.info('[ChatTiming]', JSON.stringify({
            stage: 'chat-total',
            durationMs: Math.round(performance.now() - requestStartedAt),
            intent: response.intent,
            resultCount: response.resultCount ?? 0,
        }));

        void recordChatMetric({
            requestId,
            intent: response.intent,
            responseType: response.responseType,
            totalDurationMs: Math.round(performance.now() - requestStartedAt),
            resultCount: response.resultCount ?? 0,
            cacheHit: false,
        });
        void recordChatInsight(message, response.intent, response.resultCount ?? 0);
        if (normalizedHistory.length === 0) void cacheChatResponse(message, response, response.responseType === 'results' ? 120 : 600);

        return Response.json(response, { headers: { 'x-request-id': requestId, 'x-chat-cache': 'miss' } });
    } catch (error) {
        if (error instanceof DataSourceUnavailableError) {
            return Response.json({
                responseType: 'system_error',
                response: 'מקור המידע אינו זמין כרגע. נסה שוב בעוד כמה רגעים.',
                intent: 'system_error',
                resultCount: 0,
                activityCards: [],
                eventCards: [],
                errorCode: error.code,
            }, { status: 503 });
        }
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ChatAPI] Failed to handle message:', error);
        console.info('[ChatTiming]', JSON.stringify({
            stage: 'chat-total',
            durationMs: Math.round(performance.now() - requestStartedAt),
            outcome: 'error',
        }));
        void recordChatMetric({
            requestId,
            totalDurationMs: Math.round(performance.now() - requestStartedAt),
            errorType: errMsg.slice(0, 120),
            cacheHit: false,
        });
        return Response.json({ error: 'מצטער, אירעה תקלה זמנית. אפשר לנסות שוב בעוד רגע.' }, { status: 500 });
    }
}
