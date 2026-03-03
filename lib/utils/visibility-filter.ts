import { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@/lib/types';
import { hasFullVisibility } from './roles';

// Apply visibility filter to a Supabase query based on user role
// Returns the filtered query
export function applyVisibilityFilter(
  query: any,
  role: UserRole,
  userId: string,
  managerId?: string | null,
): any {
  // Admin and gerente see everything
  if (hasFullVisibility(role)) return query;

  // Other roles see only their own contacts
  return query.eq('assigned_to_user_id', userId);
}

// Get subordinate user IDs for a manager
export async function getSubordinateIds(
  admin: SupabaseClient,
  orgId: string,
  managerId: string,
): Promise<string[]> {
  const { data } = await admin
    .from('profiles')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('manager_id', managerId);

  return (data || []).map((p: any) => p.user_id);
}
