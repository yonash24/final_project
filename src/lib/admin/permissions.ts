export type AdminRole = 'super_admin' | 'manager' | 'editor' | 'viewer';

const ROLE_PERMISSIONS: Record<AdminRole, readonly string[]> = {
    super_admin: ['read', 'content:write', 'imports:write', 'notifications:write', 'settings:write', 'admin:write', 'activity:read', 'activity:create', 'activity:update', 'activity:archive', 'activity:restore', 'activity:publish'],
    manager: ['read', 'content:write', 'imports:write', 'notifications:write', 'activity:read', 'activity:create', 'activity:update', 'activity:archive', 'activity:restore'],
    editor: ['read', 'content:write', 'imports:write', 'notifications:write', 'activity:read', 'activity:update'],
    viewer: ['read', 'activity:read'],
};

export function roleHasPermission(role: string, permission: string) {
    return ROLE_PERMISSIONS[role as AdminRole]?.includes(permission) ?? false;
}
