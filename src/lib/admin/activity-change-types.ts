/**
 * activity-change-types.ts
 * Plain types/constants shared by the activity-change write path. Kept
 * separate from activity-changes.ts (which defines ActivityChangeError
 * using a TS parameter-property constructor) so this file can be
 * imported by code that runs under node's --experimental-strip-types
 * (e.g. tests), which cannot parse parameter properties.
 */

export type ActivityChangeOperation = 'create_draft' | 'update' | 'archive' | 'restore' | 'publish';
export type ActivityChangeApprovalMethod = 'web_token' | 'whatsapp_code' | 'web_mfa';

export const OPERATION_PERMISSION: Record<ActivityChangeOperation, string> = {
    create_draft: 'activity:create',
    update: 'activity:update',
    archive: 'activity:archive',
    restore: 'activity:restore',
    publish: 'activity:publish',
};
