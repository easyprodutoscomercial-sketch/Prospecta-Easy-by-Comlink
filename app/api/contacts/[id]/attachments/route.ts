import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// GET /api/contacts/[id]/attachments - Listar anexos
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const admin = getAdminClient();

    const { data: attachments, error } = await admin
      .from('contact_attachments')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Add public URLs
    const withUrls = (attachments || []).map((att) => {
      const { data } = admin.storage.from('attachments').getPublicUrl(att.file_path);
      return { ...att, public_url: data.publicUrl };
    });

    return NextResponse.json({ attachments: withUrls });
  } catch (error: any) {
    console.error('Error listing attachments:', error);
    return NextResponse.json({ error: error.message || 'Erro ao listar anexos' }, { status: 500 });
  }
}

// POST /api/contacts/[id]/attachments - Upload anexo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    // Verify contact exists and belongs to same org
    const { data: contact } = await admin
      .from('contacts')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!contact) {
      return NextResponse.json({ error: 'Contato nao encontrado' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    console.log('[ATTACH] POST start', { contactId: id, contentType, userId: user.id });

    // Direct upload flow: browser already uploaded to Storage, just save metadata
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { file_name, file_path, file_size, mime_type } = body;
      console.log('[ATTACH] JSON flow', { file_name, file_path, file_size, mime_type });

      if (!file_name || !file_path || !file_size) {
        console.log('[ATTACH] Missing fields', { file_name, file_path, file_size, mime_type });
        return NextResponse.json({ error: 'Campos obrigatorios: file_name, file_path, file_size' }, { status: 400 });
      }

      const resolvedMimeType = mime_type || 'application/octet-stream';

      if (file_size > MAX_FILE_SIZE) {
        console.log('[ATTACH] File too large', { file_size, max: MAX_FILE_SIZE });
        return NextResponse.json({ error: 'Arquivo muito grande. Maximo 50MB.' }, { status: 400 });
      }

      const { data: attachment, error: insertError } = await admin
        .from('contact_attachments')
        .insert({
          organization_id: profile.organization_id,
          contact_id: id,
          file_name,
          file_path,
          file_size,
          mime_type: resolvedMimeType,
          uploaded_by_user_id: user.id,
          uploaded_by_name: profile.name,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[ATTACH] JSON insert error', insertError);
        throw insertError;
      }

      console.log('[ATTACH] JSON flow success', { attachmentId: attachment?.id });
      const { data: urlData } = admin.storage.from('attachments').getPublicUrl(file_path);
      return NextResponse.json({ ...attachment, public_url: urlData.publicUrl });
    }

    // FormData upload flow (small files via server)
    console.log('[ATTACH] FormData flow');
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    console.log('[ATTACH] FormData file', { fileName: file?.name, fileType: file?.type, fileSize: file?.size });

    if (!file) {
      console.log('[ATTACH] No file in FormData');
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      console.log('[ATTACH] File too large (FormData)', { fileSize: file.size, max: MAX_FILE_SIZE });
      return NextResponse.json({ error: 'Arquivo muito grande. Maximo 50MB.' }, { status: 400 });
    }

    // Generate unique file path
    const ext = file.name.split('.').pop() || 'bin';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `${profile.organization_id}/${id}/${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await admin.storage
      .from('attachments')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('[ATTACH] Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Erro ao fazer upload: ' + uploadError.message }, { status: 500 });
    }

    console.log('[ATTACH] Storage upload success', { filePath });

    // Insert record
    const { data: attachment, error: insertError } = await admin
      .from('contact_attachments')
      .insert({
        organization_id: profile.organization_id,
        contact_id: id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        uploaded_by_user_id: user.id,
        uploaded_by_name: profile.name,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[ATTACH] DB insert error:', insertError);
      throw insertError;
    }

    console.log('[ATTACH] FormData flow success', { attachmentId: attachment?.id });

    // Add public URL
    const { data: urlData } = admin.storage.from('attachments').getPublicUrl(filePath);

    return NextResponse.json({ ...attachment, public_url: urlData.publicUrl });
  } catch (error: any) {
    console.error('[ATTACH] Unhandled error:', error?.message, error?.stack || error);
    return NextResponse.json({ error: error.message || 'Erro ao fazer upload' }, { status: 500 });
  }
}
