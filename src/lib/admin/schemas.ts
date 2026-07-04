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
    start_time: emptyStringToNull(z.string()),
    end_time: emptyStringToNull(z.string()),
    price: emptyStringToNull(z.coerce.number().min(0)),
    instructor_name: emptyStringToNull(z.string()),
    location: emptyStringToNull(z.string()),
    max_participants: emptyStringToNull(z.coerce.number().int().min(1)),
    current_participants: emptyStringToNull(z.coerce.number().int().min(0)).default(0),
    is_active: z.coerce.boolean().default(true),
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
