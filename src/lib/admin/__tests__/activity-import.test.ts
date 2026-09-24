import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

import { buildImportPreview, confidenceByFieldRecord, extractedDocumentSchema, importScheduleError, parseSpreadsheet, splitDocumentText } from '../activity-import.ts';
import { toGeminiResponseSchema } from '../../ai/gemini-schema.ts';

const mapping = {
    title_he: 'שם החוג',
    target_age_group: 'קהל יעד',
    min_age: 'גיל מינימלי',
    max_age: 'גיל מקסימלי',
    start_time: 'שעת התחלה',
    price: 'מחיר',
    is_active: 'פעיל',
};

function fakeFile(bytes: Uint8Array, name = 'courses.csv') {
    return {
        name,
        type: name.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        arrayBuffer: async () => bytes.buffer,
    } as unknown as File;
}

test('parseSpreadsheet preserves Hebrew in UTF-8 CSV files', async () => {
    const csv = 'title_he,description_he\nיוגה,תרגול רגוע';
    const parsed = await parseSpreadsheet(fakeFile(new TextEncoder().encode(csv)));

    assert.equal(parsed.headers[0], 'title_he');
    assert.equal(parsed.rows[0]?.title_he, 'יוגה');
    assert.equal(parsed.rows[0]?.description_he, 'תרגול רגוע');
});

test('parseSpreadsheet preserves Hebrew in legacy Windows-1255 CSV files', async () => {
    // Windows-1255 bytes for the Hebrew words "שלום" and "חוג".
    const bytes = Uint8Array.from([
        ...new TextEncoder().encode('title_he,description_he\n'),
        0xf9, 0xec, 0xe5, 0xed, 0x2c, 0xe7, 0xe5, 0xe2,
    ]);
    const parsed = await parseSpreadsheet(fakeFile(bytes));

    assert.equal(parsed.rows[0]?.title_he, 'שלום');
    assert.equal(parsed.rows[0]?.description_he, 'חוג');
});

test('parseSpreadsheet keeps UTF-8 Hebrew when a CSV contains an isolated legacy byte', async () => {
    const bytes = Uint8Array.from([
        ...new TextEncoder().encode('title_he,price\nיוגה,180'),
        0x96,
    ]);
    const parsed = await parseSpreadsheet(fakeFile(bytes));

    assert.equal(parsed.rows[0]?.title_he, 'יוגה');
});

test('parseSpreadsheet repairs Hebrew that was already decoded as Latin-1 mojibake', async () => {
    const mojibake = '×™×•×’×”';
    const parsed = await parseSpreadsheet(fakeFile(new TextEncoder().encode(`title_he\n${mojibake}`)));

    assert.equal(parsed.rows[0]?.title_he, 'יוגה');
});

test('parseSpreadsheet repairs Hebrew that was already decoded as Windows-1255 mojibake', async () => {
    const mojibake = '׳™׳•׳’׳”';
    const parsed = await parseSpreadsheet(fakeFile(new TextEncoder().encode(`title_he\n${mojibake}`)));

    assert.equal(parsed.rows[0]?.title_he, 'יוגה');
});

test('parseSpreadsheet maps common Hebrew headers and values automatically', async () => {
    const csv = [
        'שם חוג,תיאור,תחום,קהל יעד,גיל מינימלי,גיל מקסימלי,יום,שעת התחלה,שעת סיום,מחיר,מדריך,מיקום,מכסה,פעיל',
        'יוגה לילדים,תרגול רגוע,ספורט,ילדים,6,12,שלישי,16:30,17:30,120,נועה לוי,חדר אמנות,15,כן',
    ].join('\n');
    const parsed = await parseSpreadsheet(fakeFile(new TextEncoder().encode(csv)));

    assert.equal(parsed.suggestedMapping.title_he, 'שם חוג');
    assert.equal(parsed.suggestedMapping.description_he, 'תיאור');
    assert.equal(parsed.suggestedMapping.category, 'תחום');
    assert.equal(parsed.suggestedMapping.target_age_group, 'קהל יעד');
    assert.equal(parsed.suggestedMapping.days_of_week, 'יום');
    assert.equal(parsed.rows[0]?.['שם חוג'], 'יוגה לילדים');
});

test('buildImportPreview normalizes formatted numbers, Excel times, and booleans', () => {
    const [row] = buildImportPreview([{
        'שם החוג': 'יוגה',
        'קהל יעד': 'ילדים',
        'גיל מינימלי': '6',
        'גיל מקסימלי': '12',
        'שעת התחלה': '0.75',
        'מחיר': '₪1,200',
        'פעיל': 'לא',
    }], mapping, []);

    assert.equal(row?.status, 'new');
    assert.equal(row?.payload.start_time, '18:00');
    assert.equal(row?.payload.price, 1200);
    assert.equal(row?.payload.is_active, false);
    assert.deepEqual(row?.errors, []);
});

test('buildImportPreview marks duplicate rows inside a file as invalid', () => {
    const rows = buildImportPreview([
        { 'שם החוג': 'יוגה', 'פעיל': 'כן' },
        { 'שם החוג': 'יוגה', 'פעיל': 'כן' },
    ], { title_he: 'שם החוג', is_active: 'פעיל' }, []);

    assert.equal(rows[0]?.status, 'new');
    assert.equal(rows[1]?.status, 'invalid');
    assert.ok(rows[1]?.errors.includes('כפילות בתוך הקובץ'));
});

test('buildImportPreview rejects unknown boolean values', () => {
    const [row] = buildImportPreview([
        { 'שם החוג': 'יוגה', 'פעיל': 'maybe' },
    ], { title_he: 'שם החוג', is_active: 'פעיל' }, []);

    assert.equal(row?.status, 'invalid');
    assert.ok(row?.errors.includes('ערך פעיל לא תקין'));
});

test('importScheduleError rejects schedules the database trigger cannot save', () => {
    assert.equal(importScheduleError({ days_of_week: 'יום ראשון', start_time: '17:00', end_time: '18:00' }), 'לא ניתן לזהות את יום הפעילות.');
    assert.equal(importScheduleError({ days_of_week: 'ראשון', start_time: '18:00', end_time: '17:00' }), 'שעת הסיום חייבת להיות אחרי שעת ההתחלה.');
    assert.equal(importScheduleError({ days_of_week: 'ראשון,שלישי', start_time: '17:00', end_time: '18:00' }), null);
});

test('parseSpreadsheet reads every Excel sheet and keeps its source locator', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ 'שם חוג': 'יוגה' }]), 'מרכז');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ 'שם חוג': 'שחמט' }]), 'צפון');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsed = await parseSpreadsheet(fakeFile(new Uint8Array(bytes), 'courses.xlsx'));

    assert.deepEqual(parsed.rows.map((row) => row['שם חוג']), ['יוגה', 'שחמט']);
    assert.deepEqual(parsed.evidence?.map((item) => item.sheet), ['מרכז', 'צפון']);
});

test('parseSpreadsheet ignores non-activity sheets in a mixed workbook', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ 'פריט': 'מנוי חודשי', 'מחיר': 329 }]), 'מחירון');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
        { 'שם_החוג': 'יוגה', 'יום': 'ראשון', 'שם_המרכז': 'מרכז א', 'אולם': 'סטודיו' },
        { 'שם_החוג': 'יוגה', 'יום': 'ראשון', 'שם_המרכז': 'מרכז ב', 'אולם': 'סטודיו' },
    ]), 'לוח_שעות');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsed = await parseSpreadsheet(fakeFile(new Uint8Array(bytes), 'courses.xlsx'));

    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0]?.['שם_החוג'], 'יוגה');
    assert.equal(parsed.suggestedMapping.title_he, 'שם_החוג');
    assert.equal(parsed.suggestedMapping.location, 'שם_המרכז');
    assert.equal(parsed.suggestedMapping.venue, 'אולם');
    assert.equal(parsed.evidence?.[0]?.sheet, 'לוח_שעות');
    assert.deepEqual(buildImportPreview(parsed.rows, parsed.suggestedMapping, []).map((row) => row.status), ['new', 'new']);
});

test('document extraction schema does not send Gemini the rejected 1000-item limit', () => {
    const schema = toGeminiResponseSchema(extractedDocumentSchema);
    const activities = schema.properties as Record<string, Record<string, unknown>>;
    assert.equal(activities.activities.maxItems, undefined);
});

test('buildImportPreview blocks conflicting updates and preserves unmapped fields', () => {
    const [row] = buildImportPreview([{
        'שם החוג': 'יוגה',
        'מיקום': 'מרכז',
        'יום': 'שלישי',
        'שעת התחלה': '17:00',
        'מחיר': '150',
        'עמודה מיוחדת': 'ציוד כלול',
    }], {
        title_he: 'שם החוג', location: 'מיקום', days_of_week: 'יום', start_time: 'שעת התחלה', price: 'מחיר',
    }, [{
        id: '1', category_id: null, title: 'יוגה', title_he: 'יוגה', description: null, description_he: null,
        target_age_group: null, min_age: null, max_age: null, days_of_week: 'שלישי', start_time: '17:00', end_time: null,
        start_date: null, end_date: null, price: 100, instructor_name: null, location: 'מרכז', max_participants: null,
        current_participants: 0, is_active: true, updated_at: '2026-01-01T00:00:00Z',
    }]);

    assert.equal(row.status, 'conflict');
    assert.deepEqual(row.conflicts?.price, { existing: 100, incoming: 150 });
    assert.equal(row.payload.extra_data?.['עמודה מיוחדת'], 'ציוד כלול');
});

test('buildImportPreview leaves missing fields null instead of guessing', () => {
    const [row] = buildImportPreview([{
        'שם החוג': 'קפוארה',
    }], { title_he: 'שם החוג', price: 'מחיר', start_time: 'שעת התחלה', min_age: 'גיל מינימלי' }, []);

    assert.equal(row?.status, 'new');
    assert.equal(row?.payload.price, null);
    assert.equal(row?.payload.start_time, null);
    assert.equal(row?.payload.min_age, null);
    assert.deepEqual(row?.errors, []);
});

test('confidenceByFieldRecord maps the extracted {field, confidence} list to a lookup record', () => {
    const record = confidenceByFieldRecord([
        { field: 'title_he', confidence: 0.95 },
        { field: 'price', confidence: 0.4 },
    ]);
    assert.deepEqual(record, { title_he: 0.95, price: 0.4 });
});

test('confidenceByFieldRecord handles an empty list', () => {
    assert.deepEqual(confidenceByFieldRecord([]), {});
});

test('extractedDocumentSchema accepts a Gemini-shaped extraction with an array confidence_by_field', () => {
    const parsed = extractedDocumentSchema.parse({
        activities: [{
            title_he: 'כדורגל', description_he: null, category: null, target_age_group: null,
            min_age: 6, max_age: 8, days_of_week: 'רביעי', start_time: '17:00', end_time: '18:00',
            price: 200, instructor_name: null, location: null, venue: null, group_name: null,
            contact_name: null, contact_phone: null, contact_email: null, notes: null,
            min_grade: null, max_grade: null, max_participants: null, source_page: 1,
            confidence: 0.9, confidence_by_field: [{ field: 'title_he', confidence: 0.95 }], source_excerpt: null,
        }],
    });
    assert.equal(parsed.activities[0]?.title_he, 'כדורגל');
    assert.deepEqual(parsed.activities[0]?.confidence_by_field, [{ field: 'title_he', confidence: 0.95 }]);
});

test('splitDocumentText keeps page-sized chunks bounded', () => {
    const text = '\n--- עמוד 1 ---\n' + 'א'.repeat(20) + '\n--- עמוד 2 ---\n' + 'ב'.repeat(20);
    const chunks = splitDocumentText(text, 35);
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((chunk) => chunk.length <= 35));
});
