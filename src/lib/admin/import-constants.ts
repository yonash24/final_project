export const IMPORTABLE_FIELDS = [
    'title_he',
    'description_he',
    'category',
    'target_age_group',
    'min_age',
    'max_age',
    'days_of_week',
    'start_time',
    'end_time',
    'price',
    'instructor_name',
    'location',
    'max_participants',
    'is_active',
] as const;

export type ImportableField = (typeof IMPORTABLE_FIELDS)[number];
