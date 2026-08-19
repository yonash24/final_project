import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';

import type { AdminProfile } from '@/lib/admin/auth';
import { supabaseServer } from '@/lib/supabase/server';

type AuditInput = {
    actor?: AdminProfile | null;
    action: string;
    resourceType?: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
    request?: Request | NextRequest;
};

function hashIp(ip: string | null) {
    if (!ip) return null;
    const salt = process.env.AUDIT_IP_HASH_SALT || 'local-development-salt';
    return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

export async function writeAuditLog(input: AuditInput) {
    const request = input.request;
    const ip = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? request?.headers.get('x-real-ip')
        ?? null;

    const { error } = await supabaseServer.from('admin_audit_logs').insert({
        actor_user_id: input.actor?.id ?? null,
        actor_email: input.actor?.email ?? null,
        action: input.action,
        resource_type: input.resourceType ?? null,
        resource_id: input.resourceId ?? null,
        metadata: input.metadata ?? {},
        ip_hash: hashIp(ip),
        user_agent: request?.headers.get('user-agent')?.slice(0, 500) ?? null,
    });

    if (error) console.warn('[Audit] Could not write audit event:', error.message);
}

export type ChatMetric = {
    requestId: string;
    intent?: string;
    responseType?: string;
    totalDurationMs?: number;
    classificationDurationMs?: number;
    retrievalDurationMs?: number;
    embeddingDurationMs?: number;
    generationDurationMs?: number;
    resultCount?: number;
    cacheHit?: boolean;
    retryCount?: number;
    errorType?: string;
    model?: string;
};

export async function recordChatMetric(metric: ChatMetric) {
    const { error } = await supabaseServer.from('chat_request_metrics').insert({
        request_id: metric.requestId,
        intent: metric.intent ?? null,
        response_type: metric.responseType ?? null,
        total_duration_ms: metric.totalDurationMs ?? null,
        classification_duration_ms: metric.classificationDurationMs ?? null,
        retrieval_duration_ms: metric.retrievalDurationMs ?? null,
        embedding_duration_ms: metric.embeddingDurationMs ?? null,
        generation_duration_ms: metric.generationDurationMs ?? null,
        result_count: metric.resultCount ?? 0,
        cache_hit: metric.cacheHit ?? false,
        retry_count: metric.retryCount ?? 0,
        error_type: metric.errorType ?? null,
        model: metric.model ?? process.env.GEMINI_CHAT_MODEL ?? 'gemini-3-flash-preview',
    });

    if (error) console.warn('[ChatMetrics] Could not record metric:', error.message);
}

export async function recordChatInsight(query: string, intent: string, resultCount: number) {
    const loggableIntents = new Set([
        'search_activities', 'search_events', 'activity_details', 'price_inquiry',
        'schedule_inquiry', 'age_inquiry', 'availability_inquiry', 'general_info',
    ]);
    if (!loggableIntents.has(intent)) return;

    const { error } = await supabaseServer.rpc('log_chat_query', {
        p_query: query.trim().toLocaleLowerCase('he-IL').slice(0, 200),
        p_intent: intent,
        p_had_results: resultCount > 0,
    });
    if (error) console.warn('[ChatInsights] Could not log query:', error.message);
}
