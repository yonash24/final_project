/**
 * spec-scenarios.ts
 *
 * Runs the specification's customer and admin question scenarios against
 * the REAL database and Gemini (not mocked) and prints a pass/fail table.
 * This is a manual verification tool, not part of CI — it costs real
 * model calls and needs the seeded test activities from
 * seed-test-activities.ts to already be in the database.
 *
 * Run with:
 *   npx tsx --tsconfig ./tsconfig.json src/scripts/spec-scenarios.ts [--chat] [--admin]
 * (no flags runs both suites)
 */

import { loadEnv } from './load-env';

loadEnv();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ChatScenario {
    id: string;
    message: string;
    responseType?: string;
    intent?: string;
    minCards?: number;
    mustInclude?: string[];
    mustExclude?: string[];
    textIncludes?: string[];
}

const CHAT_SCENARIOS: ChatScenario[] = [
    { id: 'C1', message: 'איזה חוגים יש?', responseType: 'results', minCards: 8, mustExclude: ['סדנת תיאטרון'] },
    { id: 'C2', message: 'איזה חוגי אמנות יש?', responseType: 'results', mustInclude: ['סטודיו קרמיקה'], mustExclude: ['סדנת תיאטרון'] },
    { id: 'C3', message: 'איזה חוגי ספורט יש ביום רביעי?', responseType: 'results', mustInclude: ['כדורגל לילדים', "ג'ודו"] },
    { id: 'C4', message: 'כמה עולה סטודיו קרמיקה?', responseType: 'answer', textIncludes: ['220'] },
    { id: 'C5', message: 'כמה עולה חוג ציור?', responseType: 'clarification', minCards: 2 },
    { id: 'C6', message: 'מה יש לילדים ביום רביעי?', responseType: 'results', mustInclude: ['סטודיו קרמיקה', 'כדורגל לילדים'] },
    { id: 'C7', message: 'יש חוג לילד בן 6?', responseType: 'results', mustInclude: ['חוג ציור לילדים'], mustExclude: ['התעמלות לגיל השלישי', 'סטודיו קרמיקה'] },
    { id: 'C8', message: 'חוגים לגילאי 8 עד 10', responseType: 'results', mustInclude: ['סטודיו קרמיקה', 'שחמט'] },
    { id: 'C9', message: 'מתי חוג שחמט?', responseType: 'answer', textIncludes: ['שני'] },
    { id: 'C10', message: 'איזה חוגים יש בסניף חדרה אחרי 17:00?', responseType: 'results', mustInclude: ['גיטרה למתחילים', 'יוגה למבוגרים'] },
    { id: 'C11', message: 'איזה חוגים יש בסניף כפר סבא?', responseType: 'clarification', textIncludes: ['לא מצאתי סניף'] },
    { id: 'C12', message: 'כמה עולה חוג טניס?', responseType: 'answer' },
    { id: 'C13', message: 'חוג לבן 45 ביום רביעי', mustExclude: ['סטודיו קרמיקה', "ג'ודו", 'כדורגל לילדים'] },
    { id: 'C14', message: 'איזה חוגים יש ביום שישי?' },
    { id: 'C15', message: 'איזה חוג יש אחר הצהריים?', responseType: 'clarification' },
    { id: 'C16', message: 'משהו לילד שלי' },
    { id: 'C17', message: 'שלום', intent: 'greeting' },
    { id: 'C18', message: 'מה מזג האוויר מחר?' },
    { id: 'C19', message: 'ספר לי על סדנת תיאטרון', mustExclude: ['סדנת תיאטרון'] },
    { id: 'C20', message: 'מה שעות הפתיחה של המתנס?' },
    { id: 'C21', message: 'מתי סטודיו קרמיקה?', responseType: 'answer', textIncludes: ['רביעי'] },
];

async function runChatScenarios() {
    const { getChatResponse } = await import('../lib/ai/chat-service.ts');
    const { invalidateChatCache } = await import('../lib/ai/chat-cache.ts');
    await invalidateChatCache();

    const rows: { id: string; message: string; pass: boolean; details: string }[] = [];
    for (const scenario of CHAT_SCENARIOS) {
        let details = '';
        let pass = true;
        try {
            const response = await getChatResponse(scenario.message, []);
            const titles = response.activityCards.map((a) => a.title_he);
            const problems: string[] = [];
            if (scenario.responseType && response.responseType !== scenario.responseType) problems.push(`type=${response.responseType} (expected ${scenario.responseType})`);
            if (scenario.intent && response.intent !== scenario.intent) problems.push(`intent=${response.intent} (expected ${scenario.intent})`);
            if (scenario.minCards != null && response.activityCards.length < scenario.minCards) problems.push(`cards=${response.activityCards.length} (expected >= ${scenario.minCards})`);
            for (const title of scenario.mustInclude ?? []) if (!titles.includes(title)) problems.push(`missing "${title}"`);
            for (const title of scenario.mustExclude ?? []) if (titles.includes(title)) problems.push(`should not include "${title}"`);
            for (const text of scenario.textIncludes ?? []) if (!response.response.includes(text)) problems.push(`response missing "${text}"`);
            pass = problems.length === 0;
            details = problems.length ? problems.join('; ') : `${response.responseType} (${response.activityCards.length} cards)`;
        } catch (error) {
            pass = false;
            details = `threw: ${error instanceof Error ? error.message : String(error)}`;
        }
        rows.push({ id: scenario.id, message: scenario.message, pass, details });
        await sleep(1500);
    }
    return rows;
}

interface AdminScenario {
    id: string;
    message: string;
    selectedActivityId?: string;
    responseType?: string;
    operation?: string;
    minCards?: number;
    textIncludes?: string[];
}

const ADMIN_SCENARIOS: AdminScenario[] = [
    { id: 'A1', message: 'הצג את כל החוגים ביום רביעי', responseType: 'results' },
    { id: 'A2', message: 'שנה את המחיר של סטודיו קרמיקה ל-250', responseType: 'confirmation', operation: 'update' },
    { id: 'A3', message: 'מחק את החוג של יום רביעי בשעה 17:00', responseType: 'clarification', minCards: 3 },
    { id: 'A5', message: 'שנה את המחיר ל-100', responseType: 'clarification' },
    { id: 'A6', message: 'שנה את המחיר של חוג טניס ל-100', responseType: 'clarification', textIncludes: ['לא נמצא'] },
    { id: 'A7', message: 'צור טיוטה לחוג שחייה לילדים בגילאי 6 עד 8 בסניף חדרה ביום שני בשעה 16:00 עד 17:00 במחיר 200', responseType: 'confirmation', operation: 'create_draft' },
    { id: 'A8', message: 'צור חוג חדש', responseType: 'clarification' },
    { id: 'A9', message: 'פרסם את סדנת תיאטרון', responseType: 'confirmation', operation: 'publish' },
];

async function runAdminScenarios() {
    const { parseAdminCommand } = await import('../lib/admin/admin-command.ts');
    const { resolveAdminActivitySelector } = await import('../lib/admin/activity-selector.ts');
    const { proposeActivityChange, cancelActivityChange, listPendingActivityChanges, ActivityChangeError } = await import('../lib/admin/activity-changes.ts');
    const { hasPermission } = await import('../lib/admin/auth.ts');
    const { runAdminAssistant } = await import('../lib/admin/assistant-flow.ts');

    const profile = { id: 'local-admin-bypass', email: 'local-admin@localhost', role: 'super_admin', is_active: true };
    const deps = {
        parseCommand: parseAdminCommand,
        resolveSelector: resolveAdminActivitySelector,
        propose: (args: Parameters<typeof proposeActivityChange>[0]) => proposeActivityChange({ ...args, channel: 'web' as const }),
        cancel: (args: { profile: typeof profile; requestId: string }) => cancelActivityChange({ profile: args.profile, requestId: args.requestId }),
        listPending: (p: typeof profile) => listPendingActivityChanges(p),
        hasPermission,
    };

    const rows: { id: string; message: string; pass: boolean; details: string }[] = [];
    for (const scenario of ADMIN_SCENARIOS) {
        let details = '';
        let pass = true;
        try {
            const result = await runAdminAssistant({ message: scenario.message, selectedActivityId: scenario.selectedActivityId, profile }, deps);
            const body = result.body as Record<string, unknown>;
            const problems: string[] = [];
            if (scenario.responseType && body.responseType !== scenario.responseType) problems.push(`type=${String(body.responseType)} (expected ${scenario.responseType})`);
            if (scenario.operation && body.operation !== scenario.operation) problems.push(`operation=${String(body.operation)} (expected ${scenario.operation})`);
            const cards = (body.activityCards as unknown[] | undefined) ?? [];
            if (scenario.minCards != null && cards.length < scenario.minCards) problems.push(`cards=${cards.length} (expected >= ${scenario.minCards})`);
            for (const text of scenario.textIncludes ?? []) if (!String(body.response ?? '').includes(text)) problems.push(`response missing "${text}"`);
            pass = problems.length === 0;
            details = problems.length ? problems.join('; ') : `${String(body.responseType)}${body.operation ? ` (${String(body.operation)})` : ''}`;

            // Never leave a pending change behind from this run.
            if (body.responseType === 'confirmation' && typeof body.requestId === 'string') {
                await cancelActivityChange({ profile, requestId: body.requestId }).catch(() => undefined);
            }
        } catch (error) {
            pass = false;
            details = error instanceof ActivityChangeError ? `ActivityChangeError: ${error.message}` : `threw: ${error instanceof Error ? error.message : String(error)}`;
        }
        rows.push({ id: scenario.id, message: scenario.message, pass, details });
        await sleep(1500);
    }
    return rows;
}

function printTable(title: string, rows: { id: string; message: string; pass: boolean; details: string }[]) {
    console.log(`\n=== ${title} ===`);
    for (const row of rows) {
        console.log(`${row.pass ? 'PASS' : 'FAIL'} [${row.id}] ${row.message}`);
        console.log(`     ${row.details}`);
    }
    const failed = rows.filter((r) => !r.pass).length;
    console.log(`${rows.length - failed}/${rows.length} passed`);
    return failed;
}

async function main() {
    const args = process.argv.slice(2);
    const runChat = args.includes('--chat') || !args.includes('--admin');
    const runAdmin = args.includes('--admin') || !args.includes('--chat');

    let failures = 0;
    if (runChat) failures += printTable('Customer chat scenarios', await runChatScenarios());
    if (runAdmin) failures += printTable('Admin assistant scenarios', await runAdminScenarios());

    if (failures > 0) {
        console.error(`\n${failures} scenario(s) failed.`);
        process.exit(1);
    }
    console.log('\nAll scenarios passed.');
}

main().catch((error) => { console.error(error); process.exit(1); });
