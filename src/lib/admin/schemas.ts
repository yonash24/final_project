import { z } from 'zod';

const emptyStringToNull = <T extends z.ZodTypeAny>(schema: T) =>
    z.preprocess((value) => (value === '' ? null : value), schema.nullable());

export const activitySchema = z.object({
    title_he: z.string().min(2),
    description_he: emptyStringToNull(z.string()),
    category_id: emptyStringToNull(z.string().uuid()),
    target_age_group: z.enum(['kids', 'teens', 'adults', 'seniors']).nullable(),
    min_age: emptyStringToNull(z.coerce.number().int().min(0)),
    max_age: emptyStringToNull(z.coerce.number().int().min(0)),
    days_of_week: emptyStringToNull(z.string()),
    start_time: emptyStringToNull(z.string().regex(/^\d{2}:\d{2}$/)),
    end_time: emptyStringToNull(z.string().regex(/^\d{2}:\d{2}$/)),
    start_date: emptyStringToNull(z.string()),
    end_date: emptyStringToNull(z.string()),
    price: emptyStringToNull(z.coerce.number().min(0)),
    instructor_name: emptyStringToNull(z.string()),
    location: emptyStringToNull(z.string()),
    branch_id: emptyStringToNull(z.string().uuid()).optional(),
    venue: emptyStringToNull(z.string()).optional(),
    group_name: emptyStringToNull(z.string()).optional(),
    contact_name: emptyStringToNull(z.string()).optional(),
    contact_phone: emptyStringToNull(z.string()).optional(),
    contact_email: emptyStringToNull(z.string().email()).optional(),
    notes: emptyStringToNull(z.string()).optional(),
    min_grade: emptyStringToNull(z.coerce.number().int().min(0).max(12)).optional(),
    max_grade: emptyStringToNull(z.coerce.number().int().min(0).max(12)).optional(),
    extra_data: z.record(z.string(), z.unknown()).optional(),
    schedules: z.array(z.object({
        day_of_week: z.number().int().min(0).max(6),
        start_time: emptyStringToNull(z.string().regex(/^\d{2}:\d{2}$/)),
        end_time: emptyStringToNull(z.string().regex(/^\d{2}:\d{2}$/)),
    }).refine((value) => !value.start_time || !value.end_time || value.start_time < value.end_time, {
        message: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',
    })).max(14).optional(),
    max_participants: emptyStringToNull(z.coerce.number().int().min(1)),
    current_participants: emptyStringToNull(z.coerce.number().int().min(0)).default(0),
    is_active: z.coerce.boolean().default(true),
}).refine((value) => value.min_age == null || value.max_age == null || value.min_age <= value.max_age, {
    message: 'טווח הגילים אינו תקין', path: ['max_age'],
}).refine((value) => value.min_grade == null || value.max_grade == null || value.min_grade <= value.max_grade, {
    message: 'טווח הכיתות אינו תקין', path: ['max_grade'],
});

export const eventSchema = z.object({
    title: z.string().min(2),
    description: emptyStringToNull(z.string()),
    event_date: z.string().min(1),
    start_time: emptyStringToNull(z.string()),
    end_time: emptyStringToNull(z.string()),
    location: emptyStringToNull(z.string()),
    type: emptyStringToNull(z.string()).default('פיזי'),
    category: emptyStringToNull(z.string()),
    max_attendees: emptyStringToNull(z.coerce.number().int().min(1)),
    current_attendees: emptyStringToNull(z.coerce.number().int().min(0)).default(0),
    is_published: z.coerce.boolean().default(true),
});

export const postSchema = z.object({
    title: emptyStringToNull(z.string()),
    content: z.string().min(5),
});

export const memberSchema = z.object({
    full_name: z.string().min(2),
    email: emptyStringToNull(z.string().email()),
    phone: emptyStringToNull(z.string()),
});
