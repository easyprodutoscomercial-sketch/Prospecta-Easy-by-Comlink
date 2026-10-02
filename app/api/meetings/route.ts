import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// Intervalos de notificacao em minutos antes da reuniao
const REMINDER_OFFSETS = [
  { minutes: 24 * 60, label: 'Amanha' },
  { minutes: 8 * 60, label: 'Hoje' },
  { minutes: 4 * 60, label: '4h' },
  { minutes: 2 * 60, label: '2h' },
  { minutes: 60, label: '1h' },
  { minutes: 15, label: '15min' },
];

function generateMeetingNotifications(
  meeting: { id: string; title: string; meeting_at: string; contact_id: string },
  contactName: string,
  userId: string,
  orgId: string
) {
  const meetingAt = new Date(meeting.meeting_at);
  const now = new Date();
  const timeStr = meetingAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

  const notifications = [];

  for (const offset of REMINDER_OFFSETS) {
    const scheduledFor = new Date(meetingAt.getTime() - offset.minutes * 60 * 1000);

    // So cria notificacoes futuras
    if (scheduledFor <= now) continue;

    let title: string;
    let body: string;

    if (offset.minutes === 24 * 60) {
      title = `Amanha: Reuniao com ${contactName} as ${timeStr}`;
      body = `${meeting.title}. Prepare-se para a reuniao de amanha!`;
    } else if (offset.minutes === 8 * 60) {
      title = `Hoje as ${timeStr}: Reuniao com ${contactName}`;
      body = `${meeting.title}. Prepare-se!`;
    } else if (offset.minutes === 4 * 60) {
      title = `Faltam 4h para reuniao com ${contactName}`;
      body = `${meeting.title} as ${timeStr}. Revise seus materiais.`;
    } else if (offset.minutes === 2 * 60) {
      title = `Faltam 2h para reuniao com ${contactName}`;
      body = `${meeting.title} as ${timeStr}. Revise seus materiais.`;
    } else if (offset.minutes === 60) {
      title = `Falta 1 hora! Reuniao com ${contactName} as ${timeStr}`;
      body = `${meeting.title}. Ultima hora antes da reuniao!`;
    } else {
      title = `AGORA! Reuniao comeca em 15 minutos!`;
      body = `${meeting.title} com ${contactName} as ${timeStr}. Va agora!`;
    }

    notifications.push({
      organization_id: orgId,
      user_id: userId,
      type: 'MEETING_REMINDER',
      title,
      body,
      contact_id: meeting.contact_id,
      scheduled_for: scheduledFor.toISOString(),
      metadata: { meeting_id: meeting.id, offset_minutes: offset.minutes },
    });
  }

  return notifications;
}

// Buscar participantes de uma lista de reunioes e anexar ao resultado
async function fetchParticipantsForMeetings(admin: any, meetingIds: string[]) {
  if (meetingIds.length === 0) return {};

  const { data: participants } = await admin
    .from('meeting_participants')
    .select('*')
    .in('meeting_id', meetingIds);

  if (!participants || participants.length === 0) return {};

  // Buscar perfis dos participantes internos para enriquecer com nome/avatar
  const internalUserIds = participants
    .filter((p: any) => p.user_id)
    .map((p: any) => p.user_id);

  let profileMap: Record<string, { name: string; email: string; avatar_url: string | null }> = {};
  if (internalUserIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('user_id, name, email, avatar_url')
      .in('user_id', internalUserIds);

    for (const p of profiles || []) {
      profileMap[p.user_id] = { name: p.name, email: p.email, avatar_url: p.avatar_url };
    }
  }

  // Agrupar por meeting_id
  const map: Record<string, any[]> = {};
  for (const p of participants) {
    if (!map[p.meeting_id]) map[p.meeting_id] = [];
    const prof = p.user_id ? profileMap[p.user_id] : null;
    map[p.meeting_id].push({
      id: p.id,
      user_id: p.user_id,
      name: prof?.name || p.name || '',
      email: prof?.email || p.email || '',
      avatar_url: prof?.avatar_url || null,
      is_external: p.is_external,
    });
  }
  return map;
}

// Inserir participantes para uma reuniao
async function insertParticipants(
  admin: any,
  meetingId: string,
  creatorUserId: string,
  participantIds: string[],
  externalParticipants: { name: string; email: string }[]
) {
  const rows: any[] = [];

  // Criador sempre participa
  const allUserIds = new Set([creatorUserId, ...participantIds]);

  for (const userId of allUserIds) {
    rows.push({
      meeting_id: meetingId,
      user_id: userId,
      is_external: false,
    });
  }

  for (const ext of externalParticipants) {
    if (ext.email) {
      rows.push({
        meeting_id: meetingId,
        name: ext.name || null,
        email: ext.email,
        is_external: true,
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await admin.from('meeting_participants').insert(rows);
    if (error) {
      console.error('Error inserting meeting participants:', JSON.stringify(error, null, 2));
    }
  }

  return allUserIds;
}

// GET /api/meetings - Lista reunioes
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const contactId = request.nextUrl.searchParams.get('contact_id');
    const status = request.nextUrl.searchParams.get('status');

    // Reunioes visiveis: as dos contatos das pipelines onde a pessoa e membro,
    // MAIS aquelas em que ela e participante.
    //
    // Antes isso era feito listando TODOS os contact_id permitidos dentro de um
    // .or(contact_id.in.(...)). Com 3769 contatos a URL passava de 130 mil
    // caracteres, o servidor recusava e a agenda devolvia 500. Mesmo erro que ja
    // tinha derrubado a aba de Contatos antes.
    //
    // Agora filtra pela pipeline atraves da juncao com contacts: a URL fica
    // do tamanho da lista de pipelines (2), nao da lista de contatos.
    const base = () => admin
      .from('meetings')
      .select('*')
      .eq('organization_id', profile.organization_id);

    let data: unknown[] | null = null;
    let error: { message: string } | null = null;

    if (profile.role === 'admin') {
      let q = base().order('meeting_at', { ascending: true });
      if (contactId) q = q.eq('contact_id', contactId);
      if (status) q = q.eq('status', status);
      const r = await q;
      data = r.data; error = r.error;
    } else {
      const { data: myMemberships } = await admin
        .from('pipeline_members')
        .select('pipeline_id')
        .eq('user_id', user.id);
      const myPipelineIds = (myMemberships || []).map((m: { pipeline_id: string }) => m.pipeline_id);

      const { data: myParticipations } = await admin
        .from('meeting_participants')
        .select('meeting_id')
        .eq('user_id', user.id);
      const myMeetingIds = (myParticipations || []).map((p: { meeting_id: string }) => p.meeting_id);

      const porPipeline: Record<string, unknown>[] = [];
      if (myPipelineIds.length > 0) {
        let q = admin
          .from('meetings')
          .select('*, contacts!inner(pipeline_id)')
          .eq('organization_id', profile.organization_id)
          .in('contacts.pipeline_id', myPipelineIds)
          .order('meeting_at', { ascending: true });
        if (contactId) q = q.eq('contact_id', contactId);
        if (status) q = q.eq('status', status);
        const r = await q;
        if (r.error) error = r.error;
        for (const m of r.data || []) {
          const { contacts: _junta, ...limpo } = m as Record<string, unknown>;
          porPipeline.push(limpo);
        }
      }

      // participacoes sao poucas: aqui a lista de ids nao estoura a URL
      const porParticipacao: Record<string, unknown>[] = [];
      if (myMeetingIds.length > 0) {
        let q = base().in('id', myMeetingIds).order('meeting_at', { ascending: true });
        if (contactId) q = q.eq('contact_id', contactId);
        if (status) q = q.eq('status', status);
        const r = await q;
        if (r.error) error = r.error;
        porParticipacao.push(...((r.data || []) as Record<string, unknown>[]));
      }

      const vistos = new Set<string>();
      data = [...porPipeline, ...porParticipacao].filter((m) => {
        const id = String((m as { id: string }).id);
        if (vistos.has(id)) return false;
        vistos.add(id);
        return true;
      });
    }

    if (error) {
      console.error('Error fetching meetings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const meetings = data || [];

    // Buscar participantes de todas as reunioes
    const meetingIds = meetings.map((m: any) => m.id);
    const participantsMap = await fetchParticipantsForMeetings(admin, meetingIds);

    const meetingsWithParticipants = meetings.map((m: any) => ({
      ...m,
      participants: participantsMap[m.id] || [],
    }));

    return NextResponse.json({ meetings: meetingsWithParticipants });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/meetings - Cria reuniao + gera notificacoes
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const body = await request.json();
    const { contact_id, title, notes, location, meeting_at, duration_minutes, meeting_type, participant_ids, external_participants } = body;

    if (!contact_id || !title || !meeting_at) {
      return NextResponse.json({ error: 'contact_id, title e meeting_at sao obrigatorios' }, { status: 400 });
    }

    const admin = getAdminClient();

    // Verificar se o contato pertence a organizacao
    const { data: contact } = await admin
      .from('contacts')
      .select('id, name, organization_id')
      .eq('id', contact_id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!contact) {
      return NextResponse.json({ error: 'Contato nao encontrado' }, { status: 404 });
    }

    // Criar reuniao
    const { data: meeting, error: meetingError } = await admin
      .from('meetings')
      .insert({
        organization_id: profile.organization_id,
        contact_id,
        created_by_user_id: user.id,
        title,
        notes: notes || null,
        location: location || null,
        meeting_at,
        duration_minutes: duration_minutes || 30,
        status: 'SCHEDULED',
        meeting_type: meeting_type || 'OUTRO',
        notifications_generated: true,
      })
      .select()
      .single();

    if (meetingError) {
      console.error('Error creating meeting:', JSON.stringify(meetingError, null, 2));
      console.error('Insert payload was:', JSON.stringify({
        organization_id: profile.organization_id,
        contact_id,
        created_by_user_id: user.id,
        title,
        notes: notes || null,
        location: location || null,
        meeting_at,
        duration_minutes: duration_minutes || 30,
        status: 'SCHEDULED',
        meeting_type: meeting_type || 'OUTRO',
      }, null, 2));
      return NextResponse.json({ error: meetingError.message, details: meetingError }, { status: 500 });
    }

    // Inserir participantes (criador + selecionados + externos)
    const allInternalUserIds = await insertParticipants(
      admin,
      meeting.id,
      user.id,
      participant_ids || [],
      external_participants || []
    );

    // Gerar notificacoes escalonadas para TODOS os participantes internos
    let totalNotifications = 0;
    for (const participantUserId of allInternalUserIds) {
      const notifications = generateMeetingNotifications(
        meeting,
        contact.name,
        participantUserId,
        profile.organization_id
      );

      if (notifications.length > 0) {
        const { error: notifError } = await admin
          .from('notifications')
          .insert(notifications);

        if (notifError) {
          console.error('Error creating meeting notifications:', JSON.stringify(notifError, null, 2));
        }
        totalNotifications += notifications.length;
      }
    }

    return NextResponse.json({ meeting, notifications_created: totalNotifications }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/meetings uncaught error:', error?.message, error?.stack || error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
