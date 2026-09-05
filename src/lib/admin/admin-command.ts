import { z } from 'zod';

import { getAdminCommandModel } from '../ai/gemini.ts';
import { parseJsonObjectResponse } from '../ai/json-response.ts';

const nullableText = z.string().trim().max(500).nullable();
const changesSchema = z.object({
    title_he: z.string().trim().min(2).max(160).optional(),
    description_he: nullableText.optional(),
    price: z.number().min(0).nullable().optional(),
    location: nullableText.optional(),
    instructor_name: nullableText.optional(),
    days_of_week: nullableText.optional(),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    min_age: z.number().int().min(0).max(120).nullable().optional(),
    max_age: z.number().int().min(0).max(120).nullable().optional(),
    min_grade: z.number().int().min(0).max(12).nullable().optional(),
    max_grade: z.number().int().min(0).max(12).nullable().optional(),
    venue: nullableText.optional(),
    group_name: nullableText.optional(),
    contact_name: nullableText.optional(),
    contact_phone: nullableText.optional(),
    contact_email: z.string().email().nullable().optional(),
    notes: nullableText.optional(),
}).strict();

export const activitySelectorSchema = z.object({
    activity_id: z.string().uuid().nullable().default(null),
    name: z.string().trim().max(160).nullable().default(null),
    branch: z.string().trim().max(160).nullable().default(null),
    day: z.string().trim().max(40).nullable().default(null),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
    age: z.number().int().min(0).max(120).nullable().default(null),
    group_name: z.string().trim().max(160).nullable().default(null),
});
export type ActivitySelector = z.infer<typeof activitySelectorSchema>;

export const adminCommandSchema = z.object({
    operation: z.enum(['query', 'create', 'update', 'archive']),
    target_name: z.string().trim().max(160).nullable(),
    target_selector: activitySelectorSchema.default(() => activitySelectorSchema.parse({})),
    query: z.string().trim().max(500).nullable(),
    changes: changesSchema.default({}),
    confidence: z.number().min(0).max(1),
});
export type AdminCommand = z.infer<typeof adminCommandSchema>;

export async function parseAdminCommand(message: string): Promise<AdminCommand> {
    const prompt = `אתה מנתח פקודות ניהול חוגים. החזר JSON בלבד עם operation (query/create/update/archive), target_name, target_selector, query, changes, confidence.
target_selector מכיל רק activity_id, name, branch, day, start_time, end_time, age, group_name. אין להמציא מסנן שלא נאמר.
אל תמציא ערכים. changes יכול להכיל רק title_he, description_he, price, location, instructor_name, days_of_week, start_time, end_time, min_age, max_age, min_grade, max_grade, venue, group_name, contact_name, contact_phone, contact_email, notes. שעה HH:MM.
מחיקה פירושה archive. פקודת הצגה/חיפוש היא query. אם אין די מידע לזיהוי יעד יחיד החזר confidence נמוך.
הודעת המנהל: ${JSON.stringify(message)}`;
    const result = await getAdminCommandModel().generateContent(prompt);
    return adminCommandSchema.parse(parseJsonObjectResponse(result.response.text()));
}
