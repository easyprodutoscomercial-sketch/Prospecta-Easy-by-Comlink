import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { sendPushToUser } from '@/lib/push/send-push';

// POST /api/push/send - Send push notification (admin only or internal)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admins' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, title, message, url } = body;

    if (!user_id || !title || !message) {
      return NextResponse.json({ error: 'user_id, title e message sao obrigatorios' }, { status: 400 });
    }

    const admin = getAdminClient();
    const sent = await sendPushToUser(admin, user_id, {
      title,
      body: message,
      url,
    });

    return NextResponse.json({ sent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
