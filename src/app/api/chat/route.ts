import { NextRequest } from 'next/server';
import crypto from 'node:crypto';

import { getCachedChatResponse, cacheChatResponse } from '@/lib/ai/chat-cache';
import { getChatResponse } from '@/lib/ai/chat-service';
import { type ChatMessage } from '@/lib/ai/intent-classifier';
import { recordChatInsight, recordChatMetric } from '@/lib/observability/audit';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;

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

        const body = await request.json();
        const message: string | undefined = body?.message;
        const history: ChatMessage[] = body?.history ?? [];

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return Response.json({ error: 'נא לשלוח הודעה תקינה.' }, { status: 400 });
        }

        if (message.length > 500) {
            return Response.json({ error: 'ההודעה ארוכה מדי. נסה לנסח בקצרה.' }, { status: 400 });
        }

        const normalizedHistory = Array.isArray(history)
            ? history.filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string').slice(-8)
            : [];

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
        return Response.json({ error: errMsg }, { status: 500 });
    }
}
