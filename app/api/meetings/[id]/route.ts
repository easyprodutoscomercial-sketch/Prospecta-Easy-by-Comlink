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

// Buscar participantes com perfis enriquecidos
async function fetchParticipants(admin: any, meetingId: string) {
  const { data: participants } = await admin
    .from('meeting_participants')
    .select('*')
    .eq('meeting_id', meetingId);

  if (!participants || participants.length === 0) return [];

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

  return participants.map((p: any) => {
    const prof = p.user_id ? profileMap[p.user_id] : null;
    return {
      id: p.id,
      user_id: p.user_id,
      name: prof?.name || p.name || '',
      email: prof?.email || p.email || '',
      avatar_url: prof?.avatar_url || null,
      is_external: p.is_external,
    };
  });
}

// GET /api/meetings/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();

    const { data, error } = await admin
      .from('meetings')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Reuniao nao encontrada' }, { status: 404 });
    }

    // Buscar participantes
    const participants = await fetchParticipants(admin, id);

    return NextResponse.json({ meeting: { ...data, participants } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/meetings/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const body = await request.json();

    // Verificar se a reuniao pertence a org
    const { data: existing } = await admin
      .from('meetings')
      .select('id, organization_id, created_by_user_id, contact_id, title, meeting_at')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Reuniao nao encontrada' }, { status: 404 });
    }

    // Verificar se o usuario e participante
    const { data: isParticipant } = await admin
      .from('meeting_participants')
      .select('id')
      .eq('meeting_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    // Criador, admin ou participante pode editar
    const canEdit = existing.created_by_user_id === user.id || profile.role === 'admin' || !!isParticipant;
    if (!canEdit) {
      return NextResponse.json({ error: 'Apenas quem criou a reuniao, um admin ou um participante pode edita-la' }, { status: 403 });
    }

    const allowedFields = ['title', 'notes', 'location', 'meeting_at', 'duration_minutes', 'status', 'meeting_type'];
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    const { data, error } = await admin
      .from('meetings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('PATCH /api/meetings/[id] update error:', JSON.stringify(error, null, 2));
      console.error('Update payload was:', JSON.stringify(updates, null, 2));
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    // Atualizar participantes se enviados
    if (body.participant_ids !== undefined || body.external_participants !== undefined) {
      // Buscar participantes antigos (internos) para saber quais sao novos
      const { data: oldParticipants } = await admin
        .from('meeting_participants')
        .select('user_id')
        .eq('meeting_id', id)
        .eq('is_external', false);

      const oldUserIds = new Set((oldParticipants || []).map((p: any) => p.user_id).filter(Boolean));

      // Replace strategy: deletar antigos, inserir novos
      await admin
        .from('meeting_participants')
        .delete()
        .eq('meeting_id', id);

      const participantIds: string[] = body.participant_ids || [];
      const externalParticipants: { name: string; email: string }[] = body.external_participants || [];

      // Criador sempre incluido
      const allUserIds = new Set([existing.created_by_user_id, ...participantIds]);

      const rows: any[] = [];
      for (const userId of allUserIds) {
        rows.push({
          meeting_id: id,
          user_id: userId,
          is_external: false,
        });
      }
      for (const ext of externalParticipants) {
        if (ext.email) {
          rows.push({
            meeting_id: id,
            name: ext.name || null,
            email: ext.email,
            is_external: true,
          });
        }
      }

      if (rows.length > 0) {
        const { error: insertErr } = await admin.from('meeting_participants').insert(rows);
        if (insertErr) {
          console.error('Error updating meeting participants:', JSON.stringify(insertErr, null, 2));
        }
      }

      // Buscar nome do contato para notificacoes
      const { data: contact } = await admin
        .from('contacts')
        .select('name')
        .eq('id', existing.contact_id)
        .single();

      const contactName = contact?.name || 'Contato';
      const meetingData = {
        id,
        title: data.title,
        meeting_at: data.meeting_at,
        contact_id: existing.contact_id,
      };

      // Gerar notificacoes para participantes NOVOS (que nao estavam antes)
      for (const userId of allUserIds) {
        if (!oldUserIds.has(userId)) {
          const notifications = generateMeetingNotifications(meetingData, contactName, userId, profile.organization_id);
          if (notifications.length > 0) {
            const { error: notifErr } = await admin.from('notifications').insert(notifications);
            if (notifErr) {
              console.error('Error creating notifications for new participant:', JSON.stringify(notifErr, null, 2));
            }
          }
        }
      }
    }

    // Se cancelou, dispensar notificacoes pendentes de TODOS
    if (body.status === 'CANCELLED') {
      await admin
        .from('notifications')
        .update({ dismissed: true })
        .eq('type', 'MEETING_REMINDER')
        .eq('read', false)
        .containedBy('metadata', { meeting_id: id } as any);

      // Fallback: buscar por metadata->meeting_id
      const { data: pendingNotifs } = await admin
        .from('notifications')
        .select('id')
        .eq('type', 'MEETING_REMINDER')
        .eq('dismissed', false)
        .filter('metadata->>meeting_id', 'eq', id);

      if (pendingNotifs && pendingNotifs.length > 0) {
        const ids = pendingNotifs.map((n: any) => n.id);
        await admin
          .from('notifications')
          .update({ dismissed: true })
          .in('id', ids);
      }
    }

    // Buscar participantes atualizados para retornar
    const participants = await fetchParticipants(admin, id);

    return NextResponse.json({ meeting: { ...data, participants } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/meetings/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();

    // Verificar se a reuniao pertence a org
    const { data: existing } = await admin
      .from('meetings')
      .select('id, organization_id, created_by_user_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Reuniao nao encontrada' }, { status: 404 });
    }

    // Apenas o criador ou admin pode deletar
    if (existing.created_by_user_id !== user.id && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas quem criou a reuniao ou um admin pode exclui-la' }, { status: 403 });
    }

    // Dispensar notificacoes de TODOS os participantes
    const { data: pendingNotifs } = await admin
      .from('notifications')
      .select('id')
      .eq('type', 'MEETING_REMINDER')
      .filter('metadata->>meeting_id', 'eq', id);

    if (pendingNotifs && pendingNotifs.length > 0) {
      const ids = pendingNotifs.map((n: any) => n.id);
      await admin
        .from('notifications')
        .update({ dismissed: true })
        .in('id', ids);
    }

    // Deletar reuniao (participantes sao deletados via CASCADE)
    const { error } = await admin
      .from('meetings')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
