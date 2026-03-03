import { SupabaseClient } from '@supabase/supabase-js';

interface AuditLogParams {
  admin: SupabaseClient;
  orgId: string;
  userId: string;
  userName: string;
  entity: string;
  entityId?: string;
  action: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  metadata?: Record<string, any>;
}

export async function logAudit({
  admin,
  orgId,
  userId,
  userName,
  entity,
  entityId,
  action,
  oldValues,
  newValues,
  metadata,
}: AuditLogParams): Promise<void> {
  try {
    await admin.from('audit_log').insert({
      organization_id: orgId,
      user_id: userId,
      user_name: userName,
      entity,
      entity_id: entityId || null,
      action,
      old_values: oldValues || null,
      new_values: newValues || null,
      metadata: metadata || {},
    });
  } catch (err) {
    console.error('Audit log error:', err);
    // Non-blocking — audit failures should not break the main flow
  }
}
