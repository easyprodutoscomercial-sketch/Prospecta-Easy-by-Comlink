import { SupabaseClient } from '@supabase/supabase-js';

export interface AutomationRule {
  id: string;
  organization_id: string;
  pipeline_id: string | null;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  run_count: number;
}

// Execute a single action on a contact
async function executeAction(
  admin: SupabaseClient,
  rule: AutomationRule,
  contactId: string,
  orgId: string,
): Promise<string> {
  switch (rule.action_type) {
    case 'MOVE_STAGE': {
      const targetStageId = rule.action_config.stage_id;
      if (targetStageId) {
        await admin.from('contacts').update({ stage_id: targetStageId }).eq('id', contactId);
        return `Movido para stage ${targetStageId}`;
      }
      return 'stage_id nao configurado';
    }
    case 'SEND_NOTIFICATION': {
      const title = rule.action_config.title || `Automacao: ${rule.name}`;
      const body = rule.action_config.body || `Regra "${rule.name}" disparou`;
      // Notify assigned user or admins
      const { data: contact } = await admin
        .from('contacts')
        .select('assigned_to_user_id')
        .eq('id', contactId)
        .single();

      const targetUserId = contact?.assigned_to_user_id;
      if (targetUserId) {
        await admin.from('notifications').insert({
          organization_id: orgId,
          user_id: targetUserId,
          type: 'AUTOMATION',
          title,
          body,
          contact_id: contactId,
          metadata: { rule_id: rule.id, rule_name: rule.name },
        });
      }
      return `Notificacao enviada`;
    }
    case 'CHANGE_TEMPERATURE': {
      const temp = rule.action_config.temperatura;
      if (temp) {
        await admin.from('contacts').update({ temperatura: temp }).eq('id', contactId);
        return `Temperatura alterada para ${temp}`;
      }
      return 'temperatura nao configurada';
    }
    case 'ASSIGN_USER': {
      const userId = rule.action_config.user_id;
      if (userId) {
        await admin.from('contacts').update({ assigned_to_user_id: userId }).eq('id', contactId);
        return `Atribuido a ${userId}`;
      }
      return 'user_id nao configurado';
    }
    default:
      return `Tipo de acao desconhecido: ${rule.action_type}`;
  }
}

// Process automations triggered by a stage change
export async function processStageChangeAutomations(
  admin: SupabaseClient,
  orgId: string,
  contactId: string,
  oldStageId: string | null,
  newStageId: string,
) {
  const { data: rules } = await admin
    .from('automation_rules')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .eq('trigger_type', 'STAGE_CHANGE');

  if (!rules || rules.length === 0) return;

  for (const rule of rules) {
    const config = rule.trigger_config;
    // Check if this stage change matches the trigger
    const matchesFrom = !config.from_stage_id || config.from_stage_id === oldStageId;
    const matchesTo = !config.to_stage_id || config.to_stage_id === newStageId;
    const matchesPipeline = !rule.pipeline_id || true; // pipeline checked at contact level

    if (matchesFrom && matchesTo && matchesPipeline) {
      const actionTaken = await executeAction(admin, rule, contactId, orgId);

      // Log execution
      await admin.from('automation_executions').insert({
        rule_id: rule.id,
        organization_id: orgId,
        contact_id: contactId,
        action_taken: actionTaken,
        details: { trigger: 'STAGE_CHANGE', old_stage_id: oldStageId, new_stage_id: newStageId },
      });

      // Update run count
      await admin.from('automation_rules')
        .update({ run_count: (rule.run_count || 0) + 1, last_run_at: new Date().toISOString() })
        .eq('id', rule.id);
    }
  }
}

// Process time-based automations (called by cron)
export async function processTimeBasedRules(admin: SupabaseClient, orgId: string) {
  const { data: rules } = await admin
    .from('automation_rules')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .in('trigger_type', ['TIME_IN_STAGE', 'NO_INTERACTION']);

  if (!rules || rules.length === 0) return 0;

  let executed = 0;
  const now = Date.now();

  for (const rule of rules) {
    const config = rule.trigger_config;

    if (rule.trigger_type === 'TIME_IN_STAGE') {
      const days = config.days || 7;
      const stageId = config.stage_id;
      if (!stageId) continue;

      const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
      const { data: contacts } = await admin
        .from('contacts')
        .select('id')
        .eq('organization_id', orgId)
        .eq('stage_id', stageId)
        .lt('updated_at', cutoff)
        .limit(50);

      for (const c of (contacts || [])) {
        // Check if already executed recently (last 24h)
        const recentCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await admin
          .from('automation_executions')
          .select('id')
          .eq('rule_id', rule.id)
          .eq('contact_id', c.id)
          .gte('created_at', recentCutoff)
          .limit(1);

        if (recent && recent.length > 0) continue;

        const actionTaken = await executeAction(admin, rule, c.id, orgId);
        await admin.from('automation_executions').insert({
          rule_id: rule.id,
          organization_id: orgId,
          contact_id: c.id,
          action_taken: actionTaken,
          details: { trigger: 'TIME_IN_STAGE', days },
        });
        executed++;
      }
    } else if (rule.trigger_type === 'NO_INTERACTION') {
      const days = config.days || 5;
      const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

      // Find contacts with no interactions since cutoff
      const { data: contacts } = await admin
        .from('contacts')
        .select('id')
        .eq('organization_id', orgId)
        .in('status', ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA'])
        .lt('updated_at', cutoff)
        .limit(50);

      for (const c of (contacts || [])) {
        const { data: recentInt } = await admin
          .from('interactions')
          .select('id')
          .eq('contact_id', c.id)
          .gte('happened_at', cutoff)
          .limit(1);

        if (recentInt && recentInt.length > 0) continue;

        // Check if already executed recently
        const recentCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await admin
          .from('automation_executions')
          .select('id')
          .eq('rule_id', rule.id)
          .eq('contact_id', c.id)
          .gte('created_at', recentCutoff)
          .limit(1);

        if (recent && recent.length > 0) continue;

        const actionTaken = await executeAction(admin, rule, c.id, orgId);
        await admin.from('automation_executions').insert({
          rule_id: rule.id,
          organization_id: orgId,
          contact_id: c.id,
          action_taken: actionTaken,
          details: { trigger: 'NO_INTERACTION', days },
        });
        executed++;
      }
    }

    // Update run count
    await admin.from('automation_rules')
      .update({ run_count: (rule.run_count || 0) + 1, last_run_at: new Date().toISOString() })
      .eq('id', rule.id);
  }

  return executed;
}
