import type { IntentFilters } from '../ai/intent-classifier.ts';

export type { IntentFilters } from '../ai/intent-classifier.ts';

export interface ActivitySearchRow {
    id: string;
    title_he: string;
    description_he: string | null;
    target_age_group: string | null;
    min_age: number | null;
    max_age: number | null;
    days_of_week: string | null;
    price: number | null;
    instructor_name: string | null;
    location: string | null;
    max_participants: number | null;
    current_participants: number | null;
    categories: { name_he: string } | null;
}

export interface EventSearchRow {
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    location: string | null;
    category: string | null;
}

const SEARCH_STOPWORDS = new Set([
    'אני',
    'אתה',
    'את',
    'אנחנו',
    'הם',
    'הן',
    'יש',
    'לי',
    'לך',
    'לנו',
    'מה',
    'כמה',
    'איפה',
    'איזה',
    'אילו',
    'האם',
    'אפשר',
    'על',
    'עם',
    'של',
    'או',
    'גם',
    'כל',
    'זה',
    'זו',
    'הזה',
    'הזאת',
    'ב',
    'ל',
    'כ',
    'ו',
    'ה',
]);

export function normalizeSearchToken(token: string) {
    const trimmed = token.trim().toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!trimmed) return '';

    if (trimmed.length > 4 && /^[בלכוה]/.test(trimmed)) {
        return trimmed.slice(1);
    }

    return trimmed;
}

export function buildSearchTokens(rawQuery?: string | null, searchTerms?: string[] | null) {
    const sourceTerms = [
        ...(searchTerms ?? []),
        ...(rawQuery ? [rawQuery] : []),
    ];

    const tokens = new Set<string>();
    for (const term of sourceTerms) {
        const normalizedTerm = term.trim().toLowerCase();
        if (!normalizedTerm) continue;

        for (const piece of normalizedTerm.split(/[\s,.;:!?/\\|()\-]+/u)) {
            const token = normalizeSearchToken(piece);
            if (token && !SEARCH_STOPWORDS.has(token)) {
                tokens.add(token);
            }
        }
    }

    return Array.from(tokens).filter((token) => token.length > 1).slice(0, 8);
}

export function scoreTextMatch(text: string | null | undefined, tokens: string[]) {
    if (!text || tokens.length === 0) return 0;

    const normalized = text.toLowerCase();
    let score = 0;

    for (const token of tokens) {
        if (!token) continue;
        if (normalized.includes(token)) {
            score += token.length >= 5 ? 0.18 : 0.08;
        }
    }

    return Math.min(score, 1);
}

function boostFilterMatchActivity(row: ActivitySearchRow, filters: IntentFilters) {
    let score = 0;

    if (filters.target_age_group && row.target_age_group === filters.target_age_group) score += 0.15;
    if (filters.max_price !== null && row.price !== null && row.price <= filters.max_price) score += 0.08;
    if (filters.free_only && row.price === 0) score += 0.12;
    if (filters.has_spots) {
        const spotsLeft = row.max_participants === null
            ? null
            : row.max_participants - (row.current_participants ?? 0);
        if (spotsLeft === null || spotsLeft > 0) score += 0.1;
    }
    if (filters.days && filters.days.length > 0 && row.days_of_week) {
        for (const day of filters.days) {
            if (row.days_of_week.includes(day)) {
                score += 0.12;
                break;
            }
        }
    }

    return score;
}

function boostFilterMatchEvent(row: EventSearchRow, filters: IntentFilters) {
    let score = 0;

    if (filters.category_keyword && row.category?.includes(filters.category_keyword)) score += 0.1;
    if (filters.specific_date && row.event_date === filters.specific_date) score += 0.2;
    if (filters.time_period === 'today') score += 0.05;

    return score;
}

export function rankActivities<T extends ActivitySearchRow>(rows: T[], tokens: string[], filters: IntentFilters) {
    return rows
        .map((row) => {
            const titleScore = scoreTextMatch(row.title_he, tokens) * 1.5;
            const descriptionScore = scoreTextMatch(row.description_he, tokens);
            const categoryScore = scoreTextMatch(row.categories?.name_he ?? null, tokens) * 1.25;
            const locationScore = scoreTextMatch(row.location, tokens) * 0.75;
            const instructorScore = scoreTextMatch(row.instructor_name, tokens) * 0.75;
            const combined = titleScore + descriptionScore + categoryScore + locationScore + instructorScore + boostFilterMatchActivity(row, filters);
            return { row, score: combined };
        })
        .sort((a, b) => b.score - a.score)
        .map(({ row }) => row);
}

export function rankEvents<T extends EventSearchRow>(rows: T[], tokens: string[], filters: IntentFilters) {
    return rows
        .map((row) => {
            const titleScore = scoreTextMatch(row.title, tokens) * 1.4;
            const descriptionScore = scoreTextMatch(row.description, tokens);
            const categoryScore = scoreTextMatch(row.category, tokens) * 1.1;
            const locationScore = scoreTextMatch(row.location, tokens) * 0.85;
            const combined = titleScore + descriptionScore + categoryScore + locationScore + boostFilterMatchEvent(row, filters);
            return { row, score: combined };
        })
        .sort((a, b) => b.score - a.score)
        .map(({ row }) => row);
}
