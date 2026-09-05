import { supabaseServer } from '@/lib/supabase/server';
import type { ActivityRow } from '@/lib/db/chat-queries';
import type { ActivitySelector } from './admin-command';

const SELECT = 'id,title,title_he,description,description_he,target_age_group,min_age,max_age,min_grade,max_grade,days_of_week,start_time,end_time,price,instructor_name,location,venue,group_name,max_participants,current_participants,is_active,publication_status,updated_at,categories(name_he),branches(name),activity_schedules(day_of_week,start_time,end_time)';

export async function resolveAdminActivitySelector(selector: ActivitySelector): Promise<ActivityRow[]> {
    let query = supabaseServer.from('activities').select(SELECT).eq('is_active', true).is('archived_at', null);
    if (selector.activity_id) query = query.eq('id', selector.activity_id);
    if (selector.name) query = query.ilike('title_he', `%${selector.name}%`);
    if (selector.branch) query = query.or(`location.ilike.%${selector.branch}%,venue.ilike.%${selector.branch}%`);
    if (selector.day) query = query.ilike('days_of_week', `%${selector.day}%`);
    if (selector.start_time) query = query.eq('start_time', selector.start_time);
    if (selector.end_time) query = query.eq('end_time', selector.end_time);
    if (selector.age != null) query = query.lte('min_age', selector.age).gte('max_age', selector.age);
    if (selector.group_name) query = query.ilike('group_name', `%${selector.group_name}%`);
    const { data, error } = await query.order('title_he').limit(20);
    if (error) throw error;
    return (data ?? []) as unknown as ActivityRow[];
}
