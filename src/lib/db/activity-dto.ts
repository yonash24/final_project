import 'server-only';

import { supabaseServer } from '@/lib/supabase/server';
import { DataSourceUnavailableError } from './data-source';

export const PUBLIC_ACTIVITY_SELECT = [
    'id', 'title_he', 'description_he', 'target_age_group', 'min_age', 'max_age',
    'min_grade', 'max_grade', 'days_of_week', 'start_time', 'end_time', 'price',
    'instructor_name', 'location', 'venue', 'group_name', 'max_participants',
    'current_participants', 'categories(name_he,icon)',
    'activity_schedules(day_of_week,start_time,end_time)',
].join(',');

function approvedActivitiesQuery() {
    return supabaseServer.from('activities').select(PUBLIC_ACTIVITY_SELECT)
        .eq('is_active', true)
        .eq('publication_status', 'approved')
        .is('archived_at', null);
}

export async function listPublicActivities() {
    const { data, error } = await approvedActivitiesQuery().order('title_he', { ascending: true });
    if (error) throw new DataSourceUnavailableError('Public activities unavailable.');
    return data ?? [];
}

export async function getPublicActivity(id: string) {
    const { data, error } = await approvedActivitiesQuery().eq('id', id).maybeSingle();
    if (error) throw new DataSourceUnavailableError('Public activity unavailable.');
    return data;
}

