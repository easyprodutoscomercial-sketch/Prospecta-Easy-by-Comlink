import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);

    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    // Se role não existe no banco, detectar: primeiro usuário da org = admin
    let role = profile.role;
    if (!role) {
      const admin = getAdminClient();
      const { data: firstUser } = await admin
        .from('profiles')
        .select('user_id')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      role = (firstUser && firstUser.user_id === profile.user_id) ? 'admin' : 'user';
    }

    return NextResponse.json({
      user_id: profile.user_id,
      name: profile.name,
      email: profile.email,
      role,
      organization_id: profile.organization_id,
      avatar_url: profile.avatar_url || null,
    });
  } catch (error: any) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
