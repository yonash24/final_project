import test from 'node:test';
import assert from 'node:assert/strict';

import { buildImportPreview, parseSpreadsheet } from '../activity-import.ts';

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
        type: 'text/csv',
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
