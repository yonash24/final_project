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
    venue?: string | null;
    group_name?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    notes?: string | null;
    branch_id?: string | null;
    extra_data?: Record<string, unknown>;
    min_grade?: number | null;
    max_grade?: number | null;
    max_participants: number | null;
    current_participants: number | null;
    is_active: boolean;
    updated_at: string;
    publication_status?: 'draft' | 'approved' | 'archived';
    activity_schedules?: Array<{ id?: string; day_of_week: number; start_time: string | null; end_time: string | null }>;
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
    provider: 'mock-whatsapp' | 'twilio-whatsapp' | 'meta-cloud-api';
    is_enabled: boolean;
    send_registration_confirmations: boolean;
    send_class_reminders: boolean;
    send_event_reminders: boolean;
    reminder_lead_hours: number;
    admin_contact_name: string | null;
    admin_contact_phone: string | null;
    provider_config: {
        twilio_from_number?: string;
        twilio_content_sids?: Partial<Record<AdminNotificationTemplate['template_key'], string>>;
        meta_phone_number_id?: string;
        meta_business_account_id?: string;
        meta_template_names?: Partial<Record<AdminNotificationTemplate['template_key'], string>>;
        meta_template_language?: string;
        status_callback_url?: string;
        test_recipient_phone?: string;
    } | null;
    updated_at: string;
}

export interface AdminNotificationTemplate {
    id: string;
    template_key: 'registration_confirmation' | 'class_reminder' | 'event_reminder' | 'change_notification';
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
    template_key: 'registration_confirmation' | 'class_reminder' | 'event_reminder' | 'change_notification' | null;
    recipient_name: string | null;
    recipient_phone: string;
    status: 'pending' | 'processing' | 'retrying' | 'suppressed' | 'simulated' | 'sent' | 'delivered' | 'failed';
    payload: Record<string, unknown>;
    rendered_body: string | null;
    related_conversation_id: string | null;
    scheduled_for: string;
    attempts_count: number;
    last_attempted_at: string | null;
    next_retry_at: string | null;
    processed_at: string | null;
    delivered_at: string | null;
    provider_message_id: string | null;
    error_message: string | null;
    last_error_code: string | null;
    provider_response: Record<string, unknown> | null;
    idempotency_key: string | null;
    created_at: string;
}

export interface AdminNotificationProviderStatus {
    provider: 'mock-whatsapp' | 'twilio-whatsapp' | 'meta-cloud-api';
    mode: 'mock' | 'live';
    isConfigured: boolean;
    requiredEnvVars: Array<{
        name: string;
        present: boolean;
        description: string;
    }>;
    warnings: string[];
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
    | 'conflict'
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
    venue: string | null;
    group_name: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    notes: string | null;
    min_grade: number | null;
    max_grade: number | null;
    max_participants: number | null;
    is_active: boolean;
    extra_data?: Record<string, unknown>;
}

export interface ImportFieldConflict {
    existing: unknown;
    incoming: unknown;
}

export interface ImportRowResult {
    rowIndex: number;
    status: ImportRowStatus;
    duplicateActivityId: string | null;
    errors: string[];
    payload: ActivityImportDraft;
    confidence?: number;
    warnings?: string[];
    conflicts?: Record<string, ImportFieldConflict>;
    expectedUpdatedAt?: string | null;
}

export interface ImportJob {
    id: string;
    source_filename: string;
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    status: 'preview' | 'processing' | 'completed' | 'failed';
    created_at: string;
}
