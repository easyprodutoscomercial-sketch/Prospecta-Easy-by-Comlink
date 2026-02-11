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

    const admin = getAdminClient();
    // Try with avatar_url first, fallback without it if column doesn't exist yet
    let users;
    const { data: usersWithAvatar, error: avatarError } = await admin
      .from('profiles')
      .select('user_id, name, email, role, avatar_url, created_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: true });

    if (avatarError) {
      // avatar_url column may not exist yet, try without it
      const { data: usersBasic, error: basicError } = await admin
        .from('profiles')
        .select('user_id, name, email, role, created_at')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: true });

      if (basicError) {
        return NextResponse.json({ error: basicError.message }, { status: 500 });
      }
      users = usersBasic;
    } else {
      users = usersWithAvatar;
    }

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error listing users:', error);
    return NextResponse.json({ error: error.message || 'Erro ao listar usuários' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 });
    }

    const admin = getAdminClient();

    let userId: string;

    // Try to create auth user (no email confirmation needed)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError) {
      // If user already exists in auth, find them and add to this org
      if (!authError.message.includes('already been registered')) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      // Look up existing auth user by email
      const { data: listData, error: listError } = await admin.auth.admin.listUsers();
      if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }
      const existingUser = listData.users.find((u) => u.email === email);
      if (!existingUser) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      // Check if user already has a profile
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('user_id, organization_id')
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (existingProfile) {
        if (existingProfile.organization_id === profile.organization_id) {
          return NextResponse.json({ error: 'Este usuário já faz parte da sua organização' }, { status: 409 });
        }
        // Move user to this organization
        const { data: updatedProfile, error: updateError } = await admin
          .from('profiles')
          .update({
            organization_id: profile.organization_id,
            name,
          })
          .eq('user_id', existingUser.id)
          .select()
          .single();

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        return NextResponse.json({ user: updatedProfile }, { status: 200 });
      }

      userId = existingUser.id;
    } else {
      userId = authData.user.id;
    }

    // Create profile linked to the same organization as the admin
    const { data: newProfile, error: profileError } = await admin
      .from('profiles')
      .insert({
        user_id: userId,
        organization_id: profile.organization_id,
        name,
        email,
        role: 'user',
      })
      .select()
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ user: newProfile }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Erro ao criar usuário' }, { status: 500 });
  }
}
