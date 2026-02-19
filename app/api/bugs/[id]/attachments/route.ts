import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// GET /api/bugs/[id]/attachments - Listar anexos do bug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const { data: attachments, error } = await admin
      .from('bug_attachments')
      .select('*')
      .eq('bug_report_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Add public URLs
    const withUrls = (attachments || []).map((att: any) => {
      const { data } = admin.storage.from('attachments').getPublicUrl(att.file_path);
      return { ...att, public_url: data.publicUrl };
    });

    return NextResponse.json({ attachments: withUrls });
  } catch (error: any) {
    console.error('Error listing bug attachments:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar anexos' },
      { status: 500 }
    );
  }
}

// POST /api/bugs/[id]/attachments - Upload anexo do bug
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    // Verify bug exists and belongs to same org
    const { data: bug } = await admin
      .from('bug_reports')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!bug) {
      return NextResponse.json({ error: 'Bug nao encontrado' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo nao permitido. Use imagens (JPEG, PNG, WebP, GIF) ou videos (MP4, WebM, MOV).' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Maximo 25MB.' }, { status: 400 });
    }

    // Generate unique file path
    const ext = file.name.split('.').pop() || 'bin';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `${profile.organization_id}/bugs/${id}/${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await admin.storage
      .from('attachments')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Erro ao fazer upload: ' + uploadError.message },
        { status: 500 }
      );
    }

    // Insert record
    const { data: attachment, error: insertError } = await admin
      .from('bug_attachments')
      .insert({
        organization_id: profile.organization_id,
        bug_report_id: id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Add public URL
    const { data: urlData } = admin.storage.from('attachments').getPublicUrl(filePath);

    return NextResponse.json({ ...attachment, public_url: urlData.publicUrl }, { status: 201 });
  } catch (error: any) {
    console.error('Error uploading bug attachment:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer upload' },
      { status: 500 }
    );
  }
}
