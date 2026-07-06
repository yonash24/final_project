import { NextRequest } from 'next/server';

import { getChatResponse } from '@/lib/ai/chat-service';
import { type ChatMessage } from '@/lib/ai/intent-classifier';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

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

        const response = await getChatResponse(message, history);
        return Response.json(response);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ChatAPI] Failed to handle message:', error);
        return Response.json({ error: message }, { status: 500 });
    }
}
