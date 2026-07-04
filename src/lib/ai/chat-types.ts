import type { ActivityRow, EventRow } from '@/lib/db/chat-queries';

export type ChatResponseType = 'answer' | 'results' | 'clarification' | 'error';

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
}
