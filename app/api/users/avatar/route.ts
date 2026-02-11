import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/users/avatar - Upload avatar for current user or specified user (admin)
export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;
    const targetUserId = formData.get('user_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo não permitido. Use JPG, PNG, WebP ou GIF.' }, { status: 400 });
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 2MB.' }, { status: 400 });
    }

    // Determine which user to update
    const userId = targetUserId && profile.role === 'admin' ? targetUserId : user.id;

    const admin = getAdminClient();

    // If admin uploading for another user, verify same org
    if (targetUserId && targetUserId !== user.id) {
      if (profile.role !== 'admin') {
        return NextResponse.json({ error: 'Apenas admins podem alterar avatar de outros usuários' }, { status: 403 });
      }
      const { data: targetProfile } = await admin
        .from('profiles')
        .select('user_id')
        .eq('user_id', targetUserId)
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (!targetProfile) {
        return NextResponse.json({ error: 'Usuário não encontrado na organização' }, { status: 404 });
      }
    }

    // Generate unique file name
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}-${Date.now()}.${ext}`;
    const filePath = `${profile.organization_id}/${fileName}`;

    // Convert File to ArrayBuffer then Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await admin.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Erro ao fazer upload: ' + uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = admin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const avatarUrl = publicUrlData.publicUrl;

    // Update profile
    const { error: updateError } = await admin
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('user_id', userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (error: any) {
    console.error('Error uploading avatar:', error);
    return NextResponse.json({ error: error.message || 'Erro ao fazer upload' }, { status: 500 });
  }
}
