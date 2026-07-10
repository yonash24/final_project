export function parseJsonObjectResponse<T>(text: string): T {
    const normalized = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

    try {
        return JSON.parse(normalized) as T;
    } catch {
        const firstBrace = normalized.indexOf('{');
        const lastBrace = normalized.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
            throw new Error('No JSON object found in model response.');
        }

        return JSON.parse(normalized.slice(firstBrace, lastBrace + 1)) as T;
    }
}
