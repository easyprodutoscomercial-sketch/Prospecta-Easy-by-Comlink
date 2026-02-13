import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

const ORG_TYPES = ['NEXT_ACTION', 'STALE_DEAL', 'NO_OWNER', 'TASK_OVERDUE', 'RISK_ALERT'];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();

    const { data: org } = await admin
      .from('organizations')
      .select('pipeline_settings')
      .eq('id', profile.organization_id)
      .single();

    const settings = org?.pipeline_settings || {};
    if (!settings.broadcast_notifications) {
      return NextResponse.json({ announcements: [], enabled: false });
    }

    const now = new Date();
    const announcements: Array<{ id: string; title: string; category: string }> = [];

    // === 1. MEETINGS — busca direto da tabela meetings, nunca esquece ===
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const { data: meetings } = await admin
      .from('meetings')
      .select('id, title, meeting_at, created_by_user_id, contact_id')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'SCHEDULED')
      .gte('meeting_at', now.toISOString())
      .lte('meeting_at', in48h)
      .order('meeting_at', { ascending: true });

    if (meetings && meetings.length > 0) {
      // Buscar nomes dos contatos
      const contactIds = [...new Set(meetings.map(m => m.contact_id))];
      const { data: contacts } = await admin
        .from('contacts')
        .select('id, name')
        .in('id', contactIds);
      const contactMap: Record<string, string> = {};
      for (const c of contacts || []) contactMap[c.id] = c.name;

      // Buscar nomes dos usuarios
      const meetingUserIds = [...new Set(meetings.map(m => m.created_by_user_id))];
      const { data: meetingProfiles } = await admin
        .from('profiles')
        .select('user_id, name')
        .in('user_id', meetingUserIds);
      const meetingNameMap: Record<string, string> = {};
      for (const p of meetingProfiles || []) meetingNameMap[p.user_id] = p.name;

      // Agrupar por dia (hoje / amanha)
      const todayStr = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      const todayMeetings: string[] = [];
      const tomorrowMeetings: string[] = [];

      for (const m of meetings) {
        const mDate = new Date(m.meeting_at);
        const mDateStr = mDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const timeStr = mDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        const contactName = contactMap[m.contact_id] || 'Contato';
        const userName = meetingNameMap[m.created_by_user_id] || '';
        const minutesUntil = Math.round((mDate.getTime() - now.getTime()) / 60000);
        const line = `${timeStr} ${contactName}${userName ? ` (${userName})` : ''}`;

        if (mDateStr === todayStr) {
          todayMeetings.push(line);
          // Alerta urgente individual para reunioes proximas
          if (minutesUntil <= 15) {
            announcements.push({ id: `urg-${m.id}`, title: `AGORA! Reuniao com ${contactName} em ${minutesUntil}min!`, category: 'meeting_urgent' });
          } else if (minutesUntil <= 60) {
            announcements.push({ id: `urg-${m.id}`, title: `Falta ${minutesUntil}min! Reuniao com ${contactName} as ${timeStr}`, category: 'meeting_urgent' });
          }
        } else if (mDateStr === tomorrowStr) {
          tomorrowMeetings.push(line);
        }
      }

      // Resumo do dia
      if (todayMeetings.length > 0) {
        announcements.push({
          id: 'meetings-today',
          title: `Hoje: ${todayMeetings.length} ${todayMeetings.length > 1 ? 'reunioes' : 'reuniao'} — ${todayMeetings.join('  •  ')}`,
          category: 'meeting_today',
        });
      }
      if (tomorrowMeetings.length > 0) {
        announcements.push({
          id: 'meetings-tomorrow',
          title: `Amanha: ${tomorrowMeetings.length} ${tomorrowMeetings.length > 1 ? 'reunioes' : 'reuniao'} — ${tomorrowMeetings.join('  •  ')}`,
          category: 'meeting_tomorrow',
        });
      }
    }

    // === 2. NOTIFICACOES PESSOAIS — exclusivas do usuario logado ===
    const { data: personalNotifs } = await admin
      .from('notifications')
      .select('id, title, body')
      .eq('user_id', user.id)
      .eq('read', false)
      .neq('type', 'MEETING_REMINDER')
      .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(10);

    for (const n of personalNotifs || []) {
      const detail = n.body ? ` — ${n.body.split('\n')[0]}` : '';
      announcements.push({ id: n.id, title: `Para voce: ${n.title}${detail}`, category: 'personal' });
    }

    // === 3. NOTIFICACOES DA ORG — gerais importantes ===
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: orgNotifs } = await admin
      .from('notifications')
      .select('id, title, body, user_id')
      .eq('organization_id', profile.organization_id)
      .in('type', ORG_TYPES)
      .gte('created_at', since24h)
      .order('created_at', { ascending: false })
      .limit(20);

    if (orgNotifs && orgNotifs.length > 0) {
      const orgUserIds = [...new Set(orgNotifs.map(n => n.user_id))];
      const { data: orgProfiles } = await admin
        .from('profiles')
        .select('user_id, name')
        .in('user_id', orgUserIds);
      const orgNameMap: Record<string, string> = {};
      for (const p of orgProfiles || []) orgNameMap[p.user_id] = p.name;

      for (const n of orgNotifs) {
        const who = orgNameMap[n.user_id] || '';
        const detail = n.body ? ` — ${n.body.split('\n')[0]}` : '';
        announcements.push({ id: n.id, title: `${who ? who + ': ' : ''}${n.title}${detail}`, category: 'org' });
      }
    }

    const durationMinutes = settings.broadcast_duration_minutes || 3;
    return NextResponse.json({ announcements, enabled: true, duration_minutes: durationMinutes });
  } catch (error: any) {
    console.error('Error fetching announcements:', error);
    return NextResponse.json({ announcements: [], enabled: false });
  }
}
