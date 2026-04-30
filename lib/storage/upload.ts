// Upload de arquivos pra Supabase Storage com validacao de seguranca.
// Centraliza logica que estava duplicada em check-in e walk-in (e outros
// lugares no futuro), garantindo whitelist de MIME e sanitizacao de nome.
//
// Por que isso importa:
//   1. Atacante (vendedor com conta comprometida ou ataque MITM no proxy)
//      pode subir arquivo .exe/.html/.php disfarcado de imagem.
//   2. URL publica do storage no nosso dominio vira vetor de phishing/RCE
//      se servidor servir com Content-Disposition inline.
//   3. file.name pode conter "../" ou "\" tentando path traversal.

const ALLOWED_IMAGE_MIME = new Set<string>([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/heic', 'image/heif',
]);

const ALLOWED_IMAGE_EXT = new Set<string>([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif',
]);

export type UploadOpts = {
  admin: any; // SupabaseClient with service_role
  file: File;
  orgId: string;
  eventId: string;
  label: string;
};

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Faz upload de IMAGEM pra bucket `attachments` validando MIME, extensao e
 * sanitizando nome. Retorna URL publica ou erro especifico.
 *
 * Path final: `<orgId>/events/<eventId>/<timestamp>-<label>-<rnd>.<ext>`
 * — file.name original NUNCA entra no path.
 */
export async function uploadEventImage({
  admin, file, orgId, eventId, label,
}: UploadOpts): Promise<UploadResult> {
  if (!file || file.size === 0) return { ok: false, error: 'Arquivo vazio' };

  // MIME whitelist (cliente pode falsificar, mas e a primeira camada)
  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIME.has(mime)) {
    return { ok: false, error: `Tipo nao permitido: ${mime || 'desconhecido'}` };
  }

  // Extensao whitelist (defesa em camadas — MIME pode mentir)
  const rawName = (file.name || '').split(/[/\\]/).pop() || ''; // tira "../"
  const ext = (rawName.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!ALLOWED_IMAGE_EXT.has(ext)) {
    return { ok: false, error: `Extensao nao permitida: ${ext || 'desconhecida'}` };
  }

  // Path 100% controlado pelo servidor (orgId, eventId, label, timestamp, rand)
  const safeLabel = label.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 30);
  const safeName = `${Date.now()}-${safeLabel}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `${orgId}/events/${eventId}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from('attachments')
    .upload(filePath, buffer, { contentType: mime });

  if (error) return { ok: false, error: error.message };

  const { data: urlData } = admin.storage.from('attachments').getPublicUrl(filePath);
  return { ok: true, url: urlData.publicUrl };
}
