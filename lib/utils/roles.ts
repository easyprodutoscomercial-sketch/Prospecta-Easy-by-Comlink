import type { UserRole } from '@/lib/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  user: 'Vendedor',
  gerente: 'Gerente',
  sdr: 'SDR',
  closer: 'Closer',
  suporte: 'Suporte',
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  gerente: 80,
  closer: 60,
  sdr: 50,
  user: 40,
  suporte: 30,
};

// Roles that can see all contacts (not just their own)
const FULL_VISIBILITY_ROLES: UserRole[] = ['admin', 'gerente'];

export function hasFullVisibility(role: UserRole): boolean {
  return FULL_VISIBILITY_ROLES.includes(role);
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'admin';
}

export function canViewAuditLog(role: UserRole): boolean {
  return role === 'admin' || role === 'gerente';
}

export function canManageAutomations(role: UserRole): boolean {
  return role === 'admin';
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] || role;
}
