import { generateStructuredOutput } from '../ai/structured-output.ts';
import { adminCommandSchema, type AdminCommand } from './admin-command-schema.ts';

export { activitySelectorSchema, adminCommandSchema } from './admin-command-schema.ts';
export type { ActivitySelector, AdminCommand } from './admin-command-schema.ts';

export async function parseAdminCommand(message: string): Promise<AdminCommand> {
    const prompt = `אתה מנתח פקודות ניהול חוגים. החזר JSON בלבד עם operation (query/create_draft/update/archive/restore/publish/cancel/list_pending), target_name, target_selector, query, changes, confidence.
target_selector מכיל רק activity_id, name, branch, day, start_time, end_time, age, group_name. אין להמציא מסנן שלא נאמר.
אל תמציא ערכים. changes יכול להכיל רק title_he, description_he, price, location, instructor_name, days_of_week, start_time, end_time, min_age, max_age, min_grade, max_grade, venue, group_name, contact_name, contact_phone, contact_email, notes, target_age_group, max_participants. שעה HH:MM.
מחיקה פירושה archive. יצירה פירושה create_draft. שחזור פירושו restore. פרסום פירושו publish. פקודת הצגה/חיפוש היא query. אם אין די מידע לזיהוי יעד יחיד החזר confidence נמוך.
הודעת המנהל: ${JSON.stringify(message)}`;
    return generateStructuredOutput(adminCommandSchema, prompt, {
        modelName: process.env.GEMINI_CHAT_MODEL || 'gemini-3-flash-preview',
        temperature: 0,
        maxOutputTokens: 1024,
    });
}
