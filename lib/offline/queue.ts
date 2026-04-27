// Fila offline: enfileira requisições quando offline e processa quando volta online.
// Usada por formulários críticos (ex: check-in em feiras).

import { queueAdd, queueList, queueRemove, queueUpdate, queueCount, QueuedItem } from './db';

const MAX_TRIES = 5;

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  queueCount().then(listener).catch(() => {});
  return () => { listeners.delete(listener); };
}

async function emit() {
  try {
    const count = await queueCount();
    listeners.forEach((l) => l(count));
  } catch {}
}

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/**
 * Envia um item diretamente (sem enfileirar). Usado pelo processor.
 */
async function sendItem(item: QueuedItem): Promise<Response> {
  // Se o body contém um marcador __file, reconstruir o FormData
  if (item.body && item.body.__form) {
    const form = new FormData();
    const fields = item.body.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      if (v == null) continue;
      form.append(k, String(v));
    }
    const files = item.body.files || [];
    for (const f of files) {
      // f = { name, field, base64, type }
      const blob = await base64ToBlob(f.base64, f.type);
      form.append(f.field, blob, f.name);
    }
    return fetch(item.endpoint, { method: item.method, body: form });
  }
  // JSON padrão
  return fetch(item.endpoint, {
    method: item.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item.body),
  });
}

async function base64ToBlob(base64: string, type: string): Promise<Blob> {
  const res = await fetch(`data:${type};base64,${base64}`);
  return res.blob();
}

/**
 * Comprime imagem no cliente antes de upload (essencial em rede ruim).
 * Reduz fotos de 5-10MB pra ~300-800KB mantendo qualidade visual.
 * - Max width 1920px (suficiente pra qualquer tela/print)
 * - JPEG qualidade 0.82
 * - Se nao for imagem, retorna o file original sem mexer
 */
export async function compressImage(file: File, maxWidth = 1920, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size < 500 * 1024) return file; // < 500KB nao precisa
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image load failed'));
      i.src = dataUrl;
    });
    const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );
    if (!blob || blob.size >= file.size) return file; // se nao reduziu, mantem original
    return new File([blob], file.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file; // em qualquer erro, manda o original
  }
}

export async function fileToBase64(file: File): Promise<{ name: string; type: string; base64: string }> {
  // Comprime ANTES de virar base64 (reduz IndexedDB + payload de rede)
  const compressed = await compressImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      resolve({
        name: compressed.name,
        type: compressed.type || 'application/octet-stream',
        base64: dataUrl.substring(comma + 1),
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(compressed);
  });
}

/**
 * Enfileira um item offline. Se estiver online, tenta enviar imediatamente
 * e só enfileira em caso de falha de rede.
 */
// Erros HTTP que sao TRANSITORIOS (rede/server) — vale tentar de novo na fila
// 408 timeout, 425 too early, 429 rate limit, 5xx server errors
const TRANSIENT_HTTP = new Set([408, 425, 429, 500, 502, 503, 504, 507, 508, 522, 524]);

export async function enqueueOrSend(item: Omit<QueuedItem, 'id' | 'createdAt' | 'tries'>): Promise<{ sent: boolean; response?: Response; queued: boolean }> {
  if (isOnline()) {
    try {
      const fake: QueuedItem = { ...item, createdAt: Date.now(), tries: 0 };
      const res = await sendItem(fake);
      if (res.ok) return { sent: true, response: res, queued: false };
      // Erro HTTP transitorio (timeout, server error) → enfileira pra retry
      if (TRANSIENT_HTTP.has(res.status)) {
        await queueAdd(item);
        emit();
        return { sent: false, queued: true, response: res };
      }
      // Erro de negocio (400, 401, 403, 404, 409, 413, 422) → nao enfileira
      return { sent: false, response: res, queued: false };
    } catch (e) {
      // Falha de rede (timeout, DNS, sem conexao) — enfileira sempre
      await queueAdd(item);
      emit();
      return { sent: false, queued: true };
    }
  }
  await queueAdd(item);
  emit();
  return { sent: false, queued: true };
}

let processing = false;
export async function processQueue(): Promise<{ processed: number; failed: number }> {
  if (processing) return { processed: 0, failed: 0 };
  if (!isOnline()) return { processed: 0, failed: 0 };
  processing = true;
  let processed = 0;
  let failed = 0;
  try {
    const items = await queueList();
    for (const item of items) {
      try {
        const res = await sendItem(item);
        if (res.ok) {
          await queueRemove(item.id!);
          processed++;
        } else if (res.status >= 400 && res.status < 500) {
          // Erro de negócio permanente — descarta após marcar erro (evita loop infinito)
          const body = await res.text().catch(() => '');
          await queueUpdate(item.id!, { tries: (item.tries || 0) + 1, lastError: `HTTP ${res.status}: ${body.slice(0, 200)}` });
          if ((item.tries || 0) + 1 >= MAX_TRIES) {
            await queueRemove(item.id!);
          }
          failed++;
        } else {
          // 5xx — tentativas futuras
          await queueUpdate(item.id!, { tries: (item.tries || 0) + 1, lastError: `HTTP ${res.status}` });
          failed++;
        }
      } catch (e: any) {
        // Falha de rede — para de processar (ficou offline no meio)
        await queueUpdate(item.id!, { tries: (item.tries || 0) + 1, lastError: e?.message || 'network' });
        failed++;
        break;
      }
    }
  } finally {
    processing = false;
    emit();
  }
  return { processed, failed };
}

/**
 * Registra listeners globais de online/offline para auto-processar.
 * Chamar uma vez no client (componente global ou layout).
 */
export function installQueueAutoFlush() {
  if (typeof window === 'undefined') return;
  if ((window as any).__controlei_queue_installed) return;
  (window as any).__controlei_queue_installed = true;
  const flush = () => { processQueue().catch(() => {}); };
  window.addEventListener('online', flush);
  // Processa ao carregar caso existam itens pendentes de sessão anterior
  if (isOnline()) {
    setTimeout(flush, 1500);
  }
}

export async function getQueueItems(): Promise<QueuedItem[]> {
  return queueList();
}
