import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/users/:id - Admin edita nome/email (e opcionalmente senha) de um usuário
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Verificar que o usuário alvo pertence à mesma organização
    const { data: targetProfile, error: targetError } = await admin
      .from('profiles')
      .select('*')
      .eq('user_id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Usuário não encontrado na organização' }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, password } = body;

    if (!name && !email && !password) {
      return NextResponse.json({ error: 'Nenhum dado para atualizar' }, { status: 400 });
    }

    // Atualizar profile na tabela profiles
    const profileUpdate: Record<string, string> = {};
    if (name) profileUpdate.name = name;
    if (email) profileUpdate.email = email;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: updateError } = await admin
        .from('profiles')
        .update(profileUpdate)
        .eq('user_id', id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    // Atualizar email e/ou senha no Supabase Auth
    const authUpdate: Record<string, string> = {};
    if (email) authUpdate.email = email;
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 });
      }
      authUpdate.password = password;
    }

    if (Object.keys(authUpdate).length > 0) {
      const { error: authError } = await admin.auth.admin.updateUserById(id, authUpdate);
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }
    }

    // Retornar profile atualizado
    const { data: updatedProfile } = await admin
      .from('profiles')
      .select('user_id, name, email, created_at')
      .eq('user_id', id)
      .single();

    return NextResponse.json(updatedProfile);
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar usuário' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/:id - Admin remove um usuário da organização
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (user.id === id) {
      return NextResponse.json({ error: 'Você não pode excluir a si mesmo' }, { status: 400 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();

    // Verificar que o usuário alvo pertence à mesma organização
    const { data: targetProfile, error: targetError } = await admin
      .from('profiles')
      .select('user_id')
      .eq('user_id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Usuário não encontrado na organização' }, { status: 404 });
    }

    // Remover profile
    const { error: deleteProfileError } = await admin
      .from('profiles')
      .delete()
      .eq('user_id', id);

    if (deleteProfileError) {
      return NextResponse.json({ error: deleteProfileError.message }, { status: 500 });
    }

    // Remover auth user
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(id);
    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir usuário' },
      { status: 500 }
    );
  }
}
