import * as XLSX from 'xlsx';
import Papa from 'papaparse';

import type { ActivityImportDraft, ImportRowResult } from './types';
import type { AdminActivity } from './types';
import type { ImportableField } from './import-constants';
export type ImportMapping = Partial<Record<ImportableField, string>>;

export interface ParsedSheetResult {
    headers: string[];
    rows: Record<string, string>[];
    suggestedMapping: ImportMapping;
}

/** The columns supported by the activity CSV importer. Additional columns are
 * retained so that the mapping step can report them to the administrator. */
export interface ActivityCsvRow {
    title_he?: string;
    description_he?: string;
    category?: string;
    target_age_group?: string;
    min_age?: string;
    max_age?: string;
    days_of_week?: string;
    start_time?: string;
    end_time?: string;
    price?: string;
    instructor_name?: string;
    location?: string;
    max_participants?: string;
    is_active?: string;
    [column: string]: string | undefined;
}

function normalizeHeader(value: string) {
    return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, '_');
}

type CsvEncoding = 'utf-8' | 'windows-1255' | 'utf-16le' | 'utf-16be';

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
    return prefix.every((byte, index) => bytes[index] === byte);
}

/**
 * Detect the encoding before parsing. A valid UTF-8 file wins when possible;
 * otherwise, Hebrew content in the Windows-1255 candidate is a strong signal
 * that the file came from an older Excel/ANSI export.
 */
export function detectCsvEncoding(buffer: ArrayBuffer): CsvEncoding {
    const bytes = new Uint8Array(buffer);

    if (hasPrefix(bytes, [0xff, 0xfe])) return 'utf-16le';
    if (hasPrefix(bytes, [0xfe, 0xff])) return 'utf-16be';
    if (hasPrefix(bytes, [0xef, 0xbb, 0xbf])) return 'utf-8';

    try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return 'utf-8';
    } catch {
        // Continue to the legacy candidate below.
    }

    const utf8 = new TextDecoder('utf-8').decode(bytes);
    const windows1255 = new TextDecoder('windows-1255').decode(bytes);
    const countHebrew = (text: string) => (text.match(/[\u0590-\u05ff]/g) ?? []).length;

    return countHebrew(windows1255) > countHebrew(utf8) ? 'windows-1255' : 'utf-8';
}

function decodeCsv(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    const encoding = detectCsvEncoding(buffer);

    return new TextDecoder(encoding).decode(bytes);
}

function buildSingleByteReverseMap(encoding: string) {
    const decoder = new TextDecoder(encoding);
    const map = new Map<string, number>();
    for (let byte = 0; byte <= 0xff; byte += 1) {
        const character = decoder.decode(Uint8Array.of(byte));
        if (!map.has(character)) map.set(character, byte);
    }
    return map;
}

// TextDecoder intentionally exposes the Windows-125x undefined/control-byte
// area as control characters. These are the printable characters commonly
// present in mojibake (for example ™ in "×™"), so add their code-page mapping
// explicitly for the reverse repair pass.
const WINDOWS_125X_EXTENDED = [
    [0x80, '€'], [0x82, '‚'], [0x83, 'ƒ'], [0x84, '„'], [0x85, '…'],
    [0x86, '†'], [0x87, '‡'], [0x88, 'ˆ'], [0x89, '‰'], [0x8a, 'Š'],
    [0x8b, '‹'], [0x8c, 'Œ'], [0x8e, 'Ž'], [0x91, '‘'], [0x92, '’'],
    [0x93, '“'], [0x94, '”'], [0x95, '•'], [0x96, '–'], [0x97, '—'],
    [0x98, '˜'], [0x99, '™'], [0x9a, 'š'], [0x9b, '›'], [0x9c, 'œ'],
    [0x9e, 'ž'], [0x9f, 'Ÿ'],
] as const;

const LATIN1_REVERSE_MAP = buildSingleByteReverseMap('iso-8859-1');
const WINDOWS_1252_REVERSE_MAP = buildSingleByteReverseMap('windows-1252');
const WINDOWS_1255_REVERSE_MAP = buildSingleByteReverseMap('windows-1255');
for (const [byte, character] of WINDOWS_125X_EXTENDED) {
    WINDOWS_1252_REVERSE_MAP.set(character, byte);
    WINDOWS_1255_REVERSE_MAP.set(character, byte);
}

function tryRepairMojibake(value: string, reverseMap: Map<string, number>) {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
        const byte = reverseMap.get(value[index]);
        if (byte == null) return null;
        bytes[index] = byte;
    }

    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return null;
    }
}

function textQuality(value: string) {
    const hebrewLetters = (value.match(/[\u0590-\u05ff]/g) ?? []).length;
    const mojibakeMarkers = (value.match(/(?:Ã|Â|×|Ð|Ñ|׳)/g) ?? []).length;
    const replacementCharacters = (value.match(/�/g) ?? []).length;
    return hebrewLetters * 4 - mojibakeMarkers * 8 - replacementCharacters * 20;
}

function repairMojibake(value: string) {
    const candidates = [
        tryRepairMojibake(value, LATIN1_REVERSE_MAP),
        tryRepairMojibake(value, WINDOWS_1252_REVERSE_MAP),
        tryRepairMojibake(value, WINDOWS_1255_REVERSE_MAP),
    ].filter((candidate): candidate is string => Boolean(candidate));

    return candidates.reduce((best, candidate) =>
        textQuality(candidate) > textQuality(best) ? candidate : best, value);
}

const HEADER_ALIASES: Record<string, ImportableField> = {
    title_he: 'title_he',
    title: 'title_he',
    'שם': 'title_he',
    'שם_חוג': 'title_he',
    'שם_החוג': 'title_he',
    'שם_פעילות': 'title_he',
    description_he: 'description_he',
    description: 'description_he',
    'תיאור': 'description_he',
    'תיאור_החוג': 'description_he',
    category: 'category',
    'קטגוריה': 'category',
    'תחום': 'category',
    target_age_group: 'target_age_group',
    'קהל_יעד': 'target_age_group',
    'קהל': 'target_age_group',
    min_age: 'min_age',
    'גיל_מינימלי': 'min_age',
    'גיל_מינ': 'min_age',
    max_age: 'max_age',
    'גיל_מקסימלי': 'max_age',
    'גיל_מקס': 'max_age',
    days_of_week: 'days_of_week',
    'ימים': 'days_of_week',
    'יום': 'days_of_week',
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
    if (isCsv) {
        const csvText = decodeCsv(buffer);
        const parsed = Papa.parse<ActivityCsvRow>(csvText, {
            header: true,
            delimiter: ',',
            skipEmptyLines: 'greedy',
            transformHeader: (header) => repairMojibake(header),
            transform: (value) => repairMojibake(value.trim()),
        });

        if (parsed.errors.length > 0) {
            const firstError = parsed.errors[0];
            throw new Error(`CSV parsing failed${firstError?.row != null ? ` on row ${firstError.row + 2}` : ''}: ${firstError?.message ?? 'invalid CSV'}`);
        }

        const rows = parsed.data.map((row) =>
            Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value ?? ''])) as Record<string, string>,
        );
        const headers = parsed.meta.fields?.map(repairMojibake) ?? [];
        const suggestedMapping: ImportMapping = {};
        headers.forEach((header) => {
            const alias = HEADER_ALIASES[normalizeHeader(header)];
            if (alias) suggestedMapping[alias] = header;
        });

        return { headers, rows, suggestedMapping };
    }

    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
    });

    const headers = rawRows.length > 0 ? Object.keys(rawRows[0]).map(repairMojibake) : [];
    const rows = rawRows.map((row) =>
        Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
                repairMojibake(key),
                repairMojibake(value == null ? '' : String(value).trim()),
            ]),
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
        if (payload.min_age != null && payload.min_age < 0 || payload.max_age != null && payload.max_age < 0) errors.push('גיל לא יכול להיות שלילי');
        if (getDraftValue(row, mapping, 'start_time') && !payload.start_time) errors.push('שעת התחלה לא תקינה');
        if (getDraftValue(row, mapping, 'end_time') && !payload.end_time) errors.push('שעת סיום לא תקינה');
        if (getDraftValue(row, mapping, 'price') && payload.price == null) errors.push('מחיר לא תקין');
        if (payload.price != null && payload.price < 0) errors.push('מחיר לא יכול להיות שלילי');
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
