import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Whitelist de tipos aceitos pelo portal publico de suporte. Cliente do
// SAC manda print do erro / planilha / pdf — nada de exe/php/html.
// Sem whitelist, atacante mandaria shell.php.jpg pra ter URL publica
// no nosso dominio servindo conteudo malicioso.
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
]);

const ALLOWED_EXT = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif',
  'pdf', 'xls', 'xlsx', 'ppt', 'pptx', 'doc', 'docx', 'txt', 'csv',
]);

// Sanitiza nome do arquivo: aceita so [a-z0-9.-_], remove path separators e
// limita tamanho. Evita path traversal via "../" e nomes inflados pra
// estourar limite de path do storage.
function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file'; // tira diretorios
  return base.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 80);
}

// POST /api/portal/[token]/tickets/[ticketId]/attachments - Upload (sem auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; ticketId: string }> }
) {
  try {
    // Rate limit: upload de 50MB e caro. 5 uploads/min/IP cobre uso normal
    // (cliente anexando varios prints num ticket).
    const ip = getClientIp(request);
    if (!checkRateLimit('portal-attachment', ip, { windowMs: 60_000, max: 5 })) {
      return NextResponse.json({ error: 'Muitas tentativas em pouco tempo. Aguarde 1 minuto.' }, { status: 429 });
    }

    const { token, ticketId } = await params;
    const admin = getAdminClient();

    // Validate token
    const { data: project } = await admin
      .from('support_projects')
      .select('id, is_active, organization_id, created_by')
      .eq('token', token)
      .single();

    if (!project || !project.is_active) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verify ticket belongs to project
    const { data: ticket } = await admin
      .from('support_tickets')
      .select('id')
      .eq('id', ticketId)
      .eq('project_id', project.id)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: 'Chamado nao encontrado' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Maximo 50MB.' }, { status: 400 });
    }

    // Valida MIME (whitelist) — bloqueia exe/php/html disfarcados
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo nao permitido' }, { status: 400 });
    }

    // Sanitiza nome + valida extensao (defesa em camadas: MIME pode ser falsificado)
    const cleanName = sanitizeFileName(file.name);
    const ext = (cleanName.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: 'Extensao nao permitida' }, { status: 400 });
    }

    // Path final usa nome aleatorio + extensao validada — file.name original NUNCA
    // entra no path do storage.
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `${project.organization_id}/suporte/${ticketId}/${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await admin.storage
      .from('attachments')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Portal upload error:', uploadError);
      return NextResponse.json(
        { error: 'Erro ao fazer upload: ' + uploadError.message },
        { status: 500 }
      );
    }

    // Insert record
    const { data: attachment, error: insertError } = await admin
      .from('support_attachments')
      .insert({
        organization_id: project.organization_id,
        ticket_id: ticketId,
        file_name: cleanName, // ja sanitizado
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: project.created_by,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const { data: urlData } = admin.storage.from('attachments').getPublicUrl(filePath);

    return NextResponse.json({ ...attachment, public_url: urlData.publicUrl }, { status: 201 });
  } catch (error: any) {
    console.error('Error uploading portal attachment:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 });
  }
}
