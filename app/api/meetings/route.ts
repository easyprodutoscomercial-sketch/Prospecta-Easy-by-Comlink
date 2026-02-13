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

    let query = admin
      .from('meetings')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('meeting_at', { ascending: true });

    if (contactId) query = query.eq('contact_id', contactId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching meetings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ meetings: data || [] });
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
    const { contact_id, title, notes, location, meeting_at, duration_minutes } = body;

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
        notifications_generated: true,
      })
      .select()
      .single();

    if (meetingError) {
      console.error('Error creating meeting:', meetingError);
      return NextResponse.json({ error: meetingError.message }, { status: 500 });
    }

    // Gerar notificacoes escalonadas
    const notifications = generateMeetingNotifications(
      meeting,
      contact.name,
      user.id,
      profile.organization_id
    );

    if (notifications.length > 0) {
      const { error: notifError } = await admin
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Error creating meeting notifications:', notifError);
      }
    }

    return NextResponse.json({ meeting, notifications_created: notifications.length }, { status: 201 });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
