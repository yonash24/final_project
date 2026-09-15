/**
 * seed-test-activities.ts
 *
 * Adds a realistic set of test activities to the existing database so the
 * spec's customer/admin question scenarios can actually be exercised (the
 * database otherwise only has a handful of activities with placeholder
 * data). Does NOT touch or remove any pre-existing activity — every row
 * this script writes is tagged `extra_data.seed = "spec-v1"` and re-running
 * the script first deletes only rows carrying that tag, so it's safe to
 * run more than once.
 *
 * Run with: npx tsx --tsconfig ./tsconfig.json src/scripts/seed-test-activities.ts
 */

import { createClient } from '@supabase/supabase-js';

import { loadEnv } from './load-env';
import { buildActivityEmbeddingText, generateEmbedding } from '../lib/ai/embeddings';

// Load .env.local before importing anything that reads env vars at module
// load time (chat-cache.ts's supabaseServer singleton does), so it must be
// a dynamic import performed after loadEnv() runs, not a static one.
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables. Ensure .env.local is set up.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const SEED_TAG = 'spec-v1';

interface SeedActivity {
    title_he: string;
    category_he: string | null;
    description_he?: string | null;
    target_age_group: 'kids' | 'teens' | 'adults' | 'seniors' | null;
    min_age: number | null;
    max_age: number | null;
    branch: string;
    days: string[];
    start_time: string;
    end_time: string;
    price: number;
    publication_status?: 'approved' | 'draft';
    is_active?: boolean;
}

// Deliberately includes: an unknown-age activity (must never be claimed to
// fit a specific age), a draft (must never appear in customer results),
// and three activities that overlap on Wednesday 17:00-18:00 (the
// "which one do you mean" ambiguous-delete/update scenario).
const SEED_ACTIVITIES: SeedActivity[] = [
    { title_he: 'חוג קרמיקה', category_he: 'אמנות ויצירה', target_age_group: 'kids', min_age: 8, max_age: 10, branch: 'הלל 18', days: ['רביעי'], start_time: '17:00', end_time: '18:00', price: 220 },
    { title_he: 'חוג ציור לילדים', category_he: 'אמנות ויצירה', target_age_group: 'kids', min_age: 6, max_age: 9, branch: 'התאנה 90', days: ['שני'], start_time: '16:00', end_time: '17:00', price: 180 },
    { title_he: 'ציור למבוגרים', category_he: 'אמנות ויצירה', target_age_group: 'adults', min_age: 18, max_age: 99, branch: 'חדרה', days: ['שני'], start_time: '19:00', end_time: '20:30', price: 250 },
    { title_he: 'כדורגל לילדים', category_he: 'ספורט', target_age_group: 'kids', min_age: 6, max_age: 8, branch: 'הלל 18', days: ['רביעי'], start_time: '17:00', end_time: '18:00', price: 200 },
    { title_he: "ג'ודו", category_he: 'ספורט', target_age_group: 'kids', min_age: 8, max_age: 12, branch: 'חדרה', days: ['רביעי'], start_time: '17:00', end_time: '18:00', price: 240 },
    { title_he: 'שחמט', category_he: 'טכנולוגיה', description_he: 'חוג משחקי חשיבה ואסטרטגיה.', target_age_group: 'kids', min_age: 8, max_age: 10, branch: 'התאנה 90', days: ['שני'], start_time: '17:30', end_time: '18:30', price: 150 },
    { title_he: 'בלט קלאסי', category_he: 'ריקוד', target_age_group: 'kids', min_age: 5, max_age: 7, branch: 'הלל 18', days: ['שלישי'], start_time: '16:30', end_time: '17:30', price: 260 },
    { title_he: 'גיטרה למתחילים', category_he: 'מוזיקה', target_age_group: 'teens', min_age: 12, max_age: 16, branch: 'חדרה', days: ['חמישי'], start_time: '18:00', end_time: '19:00', price: 280 },
    { title_he: 'יוגה למבוגרים', category_he: 'ספורט', target_age_group: 'adults', min_age: 18, max_age: 99, branch: 'חדרה', days: ['ראשון', 'שלישי'], start_time: '19:00', end_time: '20:00', price: 200 },
    { title_he: 'אנגלית מדוברת', category_he: 'שפות', target_age_group: 'adults', min_age: 18, max_age: 99, branch: 'התאנה 90', days: ['ראשון'], start_time: '20:00', end_time: '21:00', price: 300 },
    { title_he: 'חוג רובוטיקה', category_he: 'טכנולוגיה', target_age_group: 'kids', min_age: 9, max_age: 12, branch: 'הלל 18', days: ['חמישי'], start_time: '16:00', end_time: '17:30', price: 320 },
    { title_he: 'התעמלות לגיל השלישי', category_he: 'ספורט', target_age_group: null, min_age: null, max_age: null, branch: 'חדרה', days: ['שני'], start_time: '09:00', end_time: '10:00', price: 120 },
    { title_he: 'סדנת תיאטרון', category_he: 'אמנות ויצירה', target_age_group: 'kids', min_age: 7, max_age: 10, branch: 'התאנה 90', days: ['רביעי'], start_time: '18:00', end_time: '19:00', price: 190, publication_status: 'draft', is_active: false },
];

async function main() {
    console.log('Looking up branches and categories...');
    const { data: branches, error: branchError } = await supabase.from('branches').select('id, name');
    if (branchError) throw branchError;
    const branchByName = new Map((branches ?? []).map((b) => [b.name as string, b.id as string]));

    const { data: categories, error: categoryError } = await supabase.from('categories').select('id, name_he');
    if (categoryError) throw categoryError;
    const categoryByName = new Map((categories ?? []).map((c) => [c.name_he as string, c.id as string]));

    console.log(`Removing any previously seeded rows tagged "${SEED_TAG}"...`);
    const { error: deleteError } = await supabase.from('activities').delete().eq('extra_data->>seed', SEED_TAG);
    if (deleteError) throw deleteError;

    console.log(`Inserting ${SEED_ACTIVITIES.length} test activities...`);
    for (const seed of SEED_ACTIVITIES) {
        const branchId = branchByName.get(seed.branch);
        if (!branchId) {
            console.warn(`  Skipping "${seed.title_he}": branch "${seed.branch}" not found. Run this against a database that already has the seeded branches.`);
            continue;
        }
        const categoryId = seed.category_he ? categoryByName.get(seed.category_he) ?? null : null;
        const isActive = seed.is_active ?? true;
        const publicationStatus = seed.publication_status ?? 'approved';

        const { data: inserted, error: insertError } = await supabase.from('activities').insert({
            title: seed.title_he,
            title_he: seed.title_he,
            description_he: seed.description_he ?? null,
            category_id: categoryId,
            target_age_group: seed.target_age_group,
            min_age: seed.min_age,
            max_age: seed.max_age,
            days_of_week: seed.days.join(','),
            start_time: seed.start_time,
            end_time: seed.end_time,
            price: seed.price,
            location: seed.branch,
            branch_id: branchId,
            is_active: isActive,
            publication_status: publicationStatus,
            approved_at: publicationStatus === 'approved' ? new Date().toISOString() : null,
            extra_data: { seed: SEED_TAG },
        }).select('id, title_he, description_he, target_age_group, days_of_week, location, instructor_name').single();

        if (insertError || !inserted) {
            console.warn(`  Failed to insert "${seed.title_he}": ${insertError?.message}`);
            continue;
        }

        try {
            const embedding = await generateEmbedding(buildActivityEmbeddingText({ ...inserted, category_name_he: seed.category_he }));
            await supabase.from('activities').update({ embedding }).eq('id', inserted.id);
            console.log(`  Inserted + embedded: ${seed.title_he}`);
        } catch (embeddingError) {
            console.warn(`  Inserted "${seed.title_he}" but embedding generation failed (activity is still usable for keyword search):`, embeddingError);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const { invalidateChatCache } = await import('../lib/ai/chat-cache');
    await invalidateChatCache();
    console.log('Done. Chat cache invalidated so new activities are visible immediately.');
}

main().catch((error) => { console.error(error); process.exit(1); });
