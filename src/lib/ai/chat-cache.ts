import crypto from 'node:crypto';

import type { ChatApiResponse } from './chat-types';
import { supabaseServer } from '@/lib/supabase/server';

const MODEL_VERSION = process.env.GEMINI_CHAT_MODEL ?? 'gemini-3-flash-preview';
const KNOWLEDGE_VERSION = process.env.CHAT_KNOWLEDGE_VERSION ?? 'v1';

export function normalizeChatQuery(message: string) {
    return message.trim().toLocaleLowerCase('he-IL').replace(/[!?.,;:]+/g, '').replace(/\s+/g, ' ');
}

function hashQuery(message: string) {
    return crypto.createHash('sha256').update(`${MODEL_VERSION}:${KNOWLEDGE_VERSION}:${normalizeChatQuery(message)}`).digest('hex');
}

export async function getCachedChatResponse(message: string): Promise<ChatApiResponse | null> {
    const queryHash = hashQuery(message);
    const { data, error } = await supabaseServer
        .from('chat_response_cache')
        .select('response_payload, expires_at')
        .eq('query_hash', queryHash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (error || !data) return null;
    void supabaseServer.from('chat_response_cache').update({ last_accessed_at: new Date().toISOString() }).eq('query_hash', queryHash);
    return data.response_payload as ChatApiResponse;
}

export async function cacheChatResponse(message: string, response: ChatApiResponse, ttlSeconds = 300) {
    const queryHash = hashQuery(message);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const { error } = await supabaseServer.from('chat_response_cache').upsert({
        query_hash: queryHash,
        response_payload: response,
        model_version: MODEL_VERSION,
        knowledge_version: KNOWLEDGE_VERSION,
        expires_at: expiresAt,
        last_accessed_at: new Date().toISOString(),
    });
    if (error) console.warn('[ChatCache] Could not write cache:', error.message);
}

export async function invalidateChatCache() {
    const { error } = await supabaseServer.from('chat_response_cache').delete().neq('query_hash', '');
    if (error) console.warn('[ChatCache] Could not invalidate cache:', error.message);
}

export async function cleanupExpiredChatCache() {
    const { error } = await supabaseServer
        .from('chat_response_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());
    if (error) console.warn('[ChatCache] Could not clean expired cache:', error.message);
}
