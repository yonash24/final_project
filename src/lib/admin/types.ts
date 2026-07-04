export interface AdminActivity {
    id: string;
    category_id: string | null;
    title: string;
    title_he: string;
    description: string | null;
    description_he: string | null;
    target_age_group: 'kids' | 'teens' | 'adults' | 'seniors' | null;
    min_age: number | null;
    max_age: number | null;
    days_of_week: string | null;
    start_time: string | null;
    end_time: string | null;
    start_date: string | null;
    end_date: string | null;
    price: number | null;
    instructor_name: string | null;
    location: string | null;
    max_participants: number | null;
    current_participants: number | null;
    is_active: boolean;
    categories?: { id?: string; name_he: string; icon?: string | null } | null;
}

export interface AdminEvent {
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    type: string | null;
    category: string | null;
    max_attendees: number | null;
    current_attendees: number | null;
    is_published: boolean;
}

export interface AdminPost {
    id: string;
    title: string | null;
    author_name: string;
    author_role: string;
    content: string;
    likes_count: number | null;
    created_at: string;
}

export interface AdminNotificationSettings {
    id: string;
    channel: 'whatsapp';
    provider: string;
    is_enabled: boolean;
    send_registration_confirmations: boolean;
    send_class_reminders: boolean;
    send_event_reminders: boolean;
    reminder_lead_hours: number;
    admin_contact_name: string | null;
    admin_contact_phone: string | null;
    updated_at: string;
}

export interface AdminNotificationTemplate {
    id: string;
    template_key: 'registration_confirmation' | 'class_reminder' | 'event_reminder';
    channel: 'whatsapp';
    label: string;
    description: string | null;
    is_enabled: boolean;
    body: string;
    variables: string[];
    updated_at: string;
}

export interface AdminNotificationDelivery {
    id: string;
    channel: 'whatsapp';
    provider: string;
    template_key: 'registration_confirmation' | 'class_reminder' | 'event_reminder' | null;
    recipient_name: string | null;
    recipient_phone: string;
    status: 'pending' | 'simulated' | 'sent' | 'failed';
    payload: Record<string, unknown>;
    rendered_body: string | null;
    scheduled_for: string;
    processed_at: string | null;
    delivered_at: string | null;
    error_message: string | null;
    created_at: string;
}

export interface AdminMember {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    join_date: string | null;
}

export type ImportRowStatus =
    | 'new'
    | 'update_candidate'
    | 'invalid'
    | 'imported'
    | 'updated'
    | 'skipped';

export interface ActivityImportDraft {
    title_he: string;
    description_he: string | null;
    category: string | null;
    target_age_group: 'kids' | 'teens' | 'adults' | 'seniors' | null;
    min_age: number | null;
    max_age: number | null;
    days_of_week: string | null;
    start_time: string | null;
    end_time: string | null;
    price: number | null;
    instructor_name: string | null;
    location: string | null;
    max_participants: number | null;
    is_active: boolean;
}

export interface ImportRowResult {
    rowIndex: number;
    status: ImportRowStatus;
    duplicateActivityId: string | null;
    errors: string[];
    payload: ActivityImportDraft;
}

export interface ImportJob {
    id: string;
    source_filename: string;
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    status: 'preview' | 'completed';
    created_at: string;
}
