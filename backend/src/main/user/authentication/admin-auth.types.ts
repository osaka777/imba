export type AdminRole = 'superadmin' | 'finance' | 'support' | 'marketing' | 'readonly';

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  superadmin: ['*'],
  finance: ['deposits.manage', 'withdrawals.manage', 'users.read', 'audit.read', 'stats.read'],
  support: ['users.read', 'deposits.read', 'withdrawals.read', 'audit.read'],
  marketing: ['stats.read', 'bonuses.manage', 'partners.read', 'users.read'],
  readonly: ['stats.read', 'users.read', 'deposits.read', 'withdrawals.read', 'audit.read'],
};
