import * as XLSX from 'xlsx';

import type { ActivityImportDraft, ImportRowResult } from './types';
import type { AdminActivity } from './types';
import type { ImportableField } from './import-constants';
export type ImportMapping = Partial<Record<ImportableField, string>>;

export interface ParsedSheetResult {
    headers: string[];
    rows: Record<string, string>[];
    suggestedMapping: ImportMapping;
}

function normalizeHeader(value: string) {
    return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, '_');
}

function decodeCsv(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    const hasBom = (prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte);

    if (hasBom([0xff, 0xfe])) {
        return new TextDecoder('utf-16le').decode(bytes);
    }

    if (hasBom([0xfe, 0xff])) {
        return new TextDecoder('utf-16be').decode(bytes);
    }

    // Excel and most modern CSV exporters use UTF-8. Keep a non-fatal result
    // as a candidate as well: a single legacy byte in an otherwise UTF-8 file
    // should not cause all Hebrew cells to be decoded as Windows-1255.
    const utf8 = new TextDecoder('utf-8').decode(bytes);

    // Older Hebrew Excel exports commonly use Windows-1255. When both
    // decoders are possible, choose the candidate containing more Hebrew
    // letters and fewer replacement characters. This also handles files that
    // contain a mixture of UTF-8 text and a legacy byte in a numeric column.
    const windows1255 = new TextDecoder('windows-1255').decode(bytes);
    const score = (text: string) => {
        const hebrewLetters = (text.match(/[\u0590-\u05ff]/g) ?? []).length;
        const replacementCharacters = (text.match(/�/g) ?? []).length;
        // U+05F3 (׳) is the Windows-1255 rendering of the first byte of a
        // UTF-8 Hebrew sequence. Repeated occurrences are a strong signal of
        // mojibake, not real Hebrew prose.
        const mojibakeMarkers = (text.match(/׳|×|Ã/g) ?? []).length;
        return hebrewLetters * 4 - replacementCharacters * 20 - mojibakeMarkers * 8;
    };

    return score(windows1255) > score(utf8) ? windows1255 : utf8;
}

const HEADER_ALIASES: Record<string, ImportableField> = {
    title_he: 'title_he',
    title: 'title_he',
    'שם_החוג': 'title_he',
    'שם חוג': 'title_he',
    description_he: 'description_he',
    description: 'description_he',
    'תיאור': 'description_he',
    category: 'category',
    'קטגוריה': 'category',
    target_age_group: 'target_age_group',
    'קהל_יעד': 'target_age_group',
    'קהל יעד': 'target_age_group',
    min_age: 'min_age',
    'גיל_מינימלי': 'min_age',
    'גיל מינימלי': 'min_age',
    max_age: 'max_age',
    'גיל_מקסימלי': 'max_age',
    'גיל מקסימלי': 'max_age',
    days_of_week: 'days_of_week',
    'ימים': 'days_of_week',
    start_time: 'start_time',
    'שעת_התחלה': 'start_time',
    'שעת התחלה': 'start_time',
    end_time: 'end_time',
    'שעת_סיום': 'end_time',
    'שעת סיום': 'end_time',
    price: 'price',
    'מחיר': 'price',
    instructor_name: 'instructor_name',
    'מדריך': 'instructor_name',
    location: 'location',
    'מיקום': 'location',
    max_participants: 'max_participants',
    'מכסה': 'max_participants',
    is_active: 'is_active',
    'פעיל': 'is_active',
};

export async function parseSpreadsheet(file: File): Promise<ParsedSheetResult> {
    const buffer = await file.arrayBuffer();
    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
    const workbook = isCsv
        ? XLSX.read(decodeCsv(buffer), { type: 'string' })
        : XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
    });

    const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
    const rows = rawRows.map((row) =>
        Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, value == null ? '' : String(value).trim()]),
        ),
    );

    const suggestedMapping: ImportMapping = {};
    headers.forEach((header) => {
        const alias = HEADER_ALIASES[normalizeHeader(header)];
        if (alias) {
            suggestedMapping[alias] = header;
        }
    });

    return { headers, rows, suggestedMapping };
}

function parseNumber(value: string | undefined) {
    if (!value) return null;
    const normalized = value.trim().replace(/[₪$€£\s]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: string | undefined): boolean | null {
    if (!value?.trim()) return true;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'כן', 'yes', 'active'].includes(normalized)) return true;
    if (['false', '0', 'לא', 'no', 'inactive'].includes(normalized)) return false;
    return null;
}

function parseAgeGroup(value: string | undefined): ActivityImportDraft['target_age_group'] {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (['kids', 'ילדים'].includes(normalized)) return 'kids';
    if (['teens', 'נוער'].includes(normalized)) return 'teens';
    if (['adults', 'מבוגרים'].includes(normalized)) return 'adults';
    if (['seniors', 'קשישים', 'גיל שלישי'].includes(normalized)) return 'seniors';
    return null;
}

function parseTime(value: string | undefined) {
    if (!value) return null;
    const normalized = value.trim();
    if (/^\d{1,2}:\d{2}$/.test(normalized)) {
        const [hours, minutes] = normalized.split(':').map(Number);
        return hours <= 23 && minutes <= 59 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : null;
    }

    const excelSerial = Number(normalized);
    if (Number.isFinite(excelSerial) && excelSerial >= 0 && excelSerial < 1) {
        const totalMinutes = Math.round(excelSerial * 24 * 60);
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    return null;
}

function getDraftValue(row: Record<string, string>, mapping: ImportMapping, field: ImportableField) {
    const header = mapping[field];
    return header ? row[header] : '';
}

export function buildImportPreview(
    rows: Record<string, string>[],
    mapping: ImportMapping,
    existingActivities: AdminActivity[],
): ImportRowResult[] {
    const seenKeys = new Set<string>();

    return rows.map((row, index) => {
        const payload: ActivityImportDraft = {
            title_he: getDraftValue(row, mapping, 'title_he').trim(),
            description_he: getDraftValue(row, mapping, 'description_he').trim() || null,
            category: getDraftValue(row, mapping, 'category').trim() || null,
            target_age_group: parseAgeGroup(getDraftValue(row, mapping, 'target_age_group')),
            min_age: parseNumber(getDraftValue(row, mapping, 'min_age')),
            max_age: parseNumber(getDraftValue(row, mapping, 'max_age')),
            days_of_week: getDraftValue(row, mapping, 'days_of_week').trim() || null,
            start_time: parseTime(getDraftValue(row, mapping, 'start_time')),
            end_time: parseTime(getDraftValue(row, mapping, 'end_time')),
            price: parseNumber(getDraftValue(row, mapping, 'price')),
            instructor_name: getDraftValue(row, mapping, 'instructor_name').trim() || null,
            location: getDraftValue(row, mapping, 'location').trim() || null,
            max_participants: parseNumber(getDraftValue(row, mapping, 'max_participants')),
            is_active: parseBoolean(getDraftValue(row, mapping, 'is_active')) ?? false,
        };

        const errors: string[] = [];
        if (!payload.title_he) errors.push('חסר שם חוג');
        if (payload.min_age != null && payload.max_age != null && payload.min_age > payload.max_age) {
            errors.push('טווח גילאים לא תקין');
        }
        if (getDraftValue(row, mapping, 'start_time') && !payload.start_time) errors.push('שעת התחלה לא תקינה');
        if (getDraftValue(row, mapping, 'end_time') && !payload.end_time) errors.push('שעת סיום לא תקינה');
        if (getDraftValue(row, mapping, 'price') && payload.price == null) errors.push('מחיר לא תקין');
        if (getDraftValue(row, mapping, 'max_participants') && payload.max_participants == null) errors.push('מכסה לא תקינה');
        if (getDraftValue(row, mapping, 'is_active') && parseBoolean(getDraftValue(row, mapping, 'is_active')) == null) errors.push('ערך פעיל לא תקין');

        const duplicateKey = [payload.title_he, payload.instructor_name ?? '', payload.days_of_week ?? '', payload.start_time ?? '']
            .map((value) => value.trim().toLowerCase()).join('|');
        const duplicateInFile = seenKeys.has(duplicateKey);
        seenKeys.add(duplicateKey);

        const duplicate = existingActivities.find((activity) =>
            activity.title_he.trim().toLowerCase() === payload.title_he.trim().toLowerCase() &&
            (activity.instructor_name ?? '').trim().toLowerCase() === (payload.instructor_name ?? '').trim().toLowerCase() &&
            (activity.days_of_week ?? '').trim().toLowerCase() === (payload.days_of_week ?? '').trim().toLowerCase() &&
            (activity.start_time ?? '').slice(0, 5) === (payload.start_time ?? ''),
        );

        return {
            rowIndex: index + 2,
            status: errors.length > 0 || duplicateInFile ? 'invalid' : duplicate ? 'update_candidate' : 'new',
            duplicateActivityId: duplicate?.id ?? null,
            errors: duplicateInFile ? [...errors, 'כפילות בתוך הקובץ'] : errors,
            payload,
        };
    });
}
