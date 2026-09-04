import { z } from 'zod';

import { getAdminCommandModel } from '@/lib/ai/gemini';
import { parseJsonObjectResponse } from '@/lib/ai/json-response';

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
}).strict();

export const adminCommandSchema = z.object({
    operation: z.enum(['query', 'create', 'update', 'archive']),
    target_name: z.string().trim().max(160).nullable(),
    query: z.string().trim().max(500).nullable(),
    changes: changesSchema.default({}),
    confidence: z.number().min(0).max(1),
});
export type AdminCommand = z.infer<typeof adminCommandSchema>;

export async function parseAdminCommand(message: string): Promise<AdminCommand> {
    const prompt = `אתה מנתח פקודות ניהול חוגים. החזר JSON בלבד עם operation (query/create/update/archive), target_name, query, changes, confidence.
אל תמציא ערכים. changes יכול להכיל רק title_he, description_he, price, location, instructor_name, days_of_week, start_time, end_time, min_age, max_age. שעה HH:MM.
מחיקה פירושה archive. פקודת הצגה/חיפוש היא query. אם יעד שינוי אינו ברור החזר confidence נמוך או target_name null.
הודעת המנהל: ${JSON.stringify(message)}`;
    const result = await getAdminCommandModel().generateContent(prompt);
    return adminCommandSchema.parse(parseJsonObjectResponse(result.response.text()));
}
