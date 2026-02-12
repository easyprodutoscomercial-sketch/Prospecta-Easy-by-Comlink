import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { analyzeContacts } from '@/lib/ai/rules-engine';
import { ContactForAnalysis, RiskAlert, NotificationType } from '@/lib/ai/types';

function riskRuleToNotificationType(rule: string): NotificationType {
  switch (rule) {
    case 'STALE_DEAL': return 'STALE_DEAL';
    case 'TASK_OVERDUE': return 'TASK_OVERDUE';
    case 'NO_OWNER': return 'NO_OWNER';
    default: return 'RISK_ALERT';
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    if (profile.role !== 'admin') return NextResponse.json({ error: 'Apenas administradores podem executar análise' }, { status: 403 });

    const admin = getAdminClient();
    const orgId = profile.organization_id;

    // Fetch active contacts with their interactions
    const { data: contacts, error: contactsError } = await admin
      .from('contacts')
      .select('*')
      .eq('organization_id', orgId)
      .in('status', ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA']);

    if (contactsError) throw contactsError;
    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ alerts: [], created: 0 });
    }

    // Fetch interactions for all active contacts
    const contactIds = contacts.map((c) => c.id);
    const { data: interactions, error: intError } = await admin
      .from('interactions')
      .select('contact_id, type, outcome, happened_at, created_at')
      .eq('organization_id', orgId)
      .in('contact_id', contactIds)
      .order('happened_at', { ascending: false });

    if (intError) throw intError;

    // Group interactions by contact
    const interactionsByContact = new Map<string, any[]>();
    for (const i of (interactions || [])) {
      const list = interactionsByContact.get(i.contact_id) || [];
      list.push(i);
      interactionsByContact.set(i.contact_id, list);
    }

    // Build ContactForAnalysis array
    const contactsForAnalysis: ContactForAnalysis[] = contacts.map((c) => ({
      ...c,
      interactions: (interactionsByContact.get(c.id) || []).slice(0, 10),
    }));

    // Run rules engine
    const alerts = analyzeContacts(contactsForAnalysis);

    // Determine target users for notifications
    // For contacts with owners, notify the owner
    // For unowned contacts, notify admins
    const { data: admins } = await admin
      .from('profiles')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('role', 'admin');

    const adminIds = (admins || []).map((a) => a.user_id);

    // Create notifications (avoid duplicates from last 6 hours)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifications } = await admin
      .from('notifications')
      .select('contact_id, type')
      .eq('organization_id', orgId)
      .gte('created_at', sixHoursAgo);

    const recentKeys = new Set(
      (recentNotifications || []).map((n) => `${n.contact_id}:${n.type}`)
    );

    const notificationsToCreate: any[] = [];
    for (const alert of alerts) {
      const notifType = riskRuleToNotificationType(alert.rule);
      const key = `${alert.contactId}:${notifType}`;
      if (recentKeys.has(key)) continue;

      // Find the contact to determine who to notify
      const contact = contacts.find((c) => c.id === alert.contactId);
      const targetUsers = contact?.assigned_to_user_id
        ? [contact.assigned_to_user_id]
        : adminIds;

      for (const userId of targetUsers) {
        notificationsToCreate.push({
          organization_id: orgId,
          user_id: userId,
          type: notifType,
          title: alert.title,
          body: alert.description,
          contact_id: alert.contactId,
          metadata: { rule: alert.rule, level: alert.level, daysStale: alert.daysStale, value: alert.value },
        });
      }
    }

    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await admin
        .from('notifications')
        .insert(notificationsToCreate);
      if (insertError) throw insertError;
    }

    return NextResponse.json({
      alerts,
      created: notificationsToCreate.length,
      total_contacts_analyzed: contacts.length,
    });
  } catch (error: any) {
    console.error('Error in AI analyze:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
