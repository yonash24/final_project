import type { ActivityRow, EventRow } from '@/lib/db/chat-queries';

export type ChatResponseType = 'answer' | 'results' | 'clarification' | 'error' | 'system_error';

export interface ClarificationOption {
    label: string;
    value: string;
}

export interface ChatApiResponse {
    responseType: ChatResponseType;
    response: string;
    intent: string;
    resultCount: number;
    activityCards: ActivityRow[];
    eventCards: EventRow[];
    clarificationOptions?: ClarificationOption[];
    /** RAG knowledge context used for the response (for debugging/insights) */
    knowledgeContext?: string;
    /** Suggested similar activities (populated for recommendation responses) */
    similarActivities?: { id: string; title_he: string; similarity: number }[];
    matchReasons?: Record<string, string[]>;
    warnings?: Record<string, string[]>;
    appliedFilters?: Record<string, unknown>;
    missingDataSummary?: string[];
}
