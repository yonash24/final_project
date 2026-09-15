import { z } from 'zod';

const nullableText = z.string().trim().max(500).nullable();
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const changesSchema = z.object({
    title_he: z.string().trim().min(2).max(160).optional(),
    description_he: nullableText.optional(), price: z.number().min(0).nullable().optional(),
    location: nullableText.optional(), instructor_name: nullableText.optional(), days_of_week: nullableText.optional(),
    start_time: timeSchema.nullable().optional(), end_time: timeSchema.nullable().optional(),
    min_age: z.number().int().min(0).max(120).nullable().optional(), max_age: z.number().int().min(0).max(120).nullable().optional(),
    min_grade: z.number().int().min(0).max(12).nullable().optional(), max_grade: z.number().int().min(0).max(12).nullable().optional(),
    venue: nullableText.optional(), group_name: nullableText.optional(), contact_name: nullableText.optional(),
    contact_phone: nullableText.optional(), contact_email: z.string().email().nullable().optional(), notes: nullableText.optional(),
    target_age_group: z.enum(['kids', 'teens', 'adults', 'seniors']).nullable().optional(),
    max_participants: z.number().int().positive().nullable().optional(),
}).strict();

export const activitySelectorSchema = z.object({
    activity_id: z.string().uuid().nullable().default(null), name: z.string().trim().max(160).nullable().default(null),
    branch: z.string().trim().max(160).nullable().default(null), day: z.string().trim().max(40).nullable().default(null),
    start_time: timeSchema.nullable().default(null), end_time: timeSchema.nullable().default(null),
    age: z.number().int().min(0).max(120).nullable().default(null), group_name: z.string().trim().max(160).nullable().default(null),
}).strict();
export type ActivitySelector = z.infer<typeof activitySelectorSchema>;

export const adminCommandSchema = z.object({
    operation: z.enum(['query', 'create_draft', 'update', 'archive', 'restore', 'publish', 'cancel', 'list_pending']),
    target_name: z.string().trim().max(160).nullable(),
    target_selector: activitySelectorSchema.default(() => activitySelectorSchema.parse({})),
    query: z.string().trim().max(500).nullable(), changes: changesSchema.default({}), confidence: z.number().min(0).max(1),
}).strict();
export type AdminCommand = z.infer<typeof adminCommandSchema>;
