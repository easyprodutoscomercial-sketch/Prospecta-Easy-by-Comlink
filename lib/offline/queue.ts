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

export async function fileToBase64(file: File): Promise<{ name: string; type: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      resolve({
        name: file.name,
        type: file.type || 'application/octet-stream',
        base64: dataUrl.substring(comma + 1),
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Enfileira um item offline. Se estiver online, tenta enviar imediatamente
 * e só enfileira em caso de falha de rede.
 */
export async function enqueueOrSend(item: Omit<QueuedItem, 'id' | 'createdAt' | 'tries'>): Promise<{ sent: boolean; response?: Response; queued: boolean }> {
  if (isOnline()) {
    try {
      const fake: QueuedItem = { ...item, createdAt: Date.now(), tries: 0 };
      const res = await sendItem(fake);
      if (res.ok) return { sent: true, response: res, queued: false };
      // Erro HTTP — não enfileira (é problema de negócio, não de conectividade)
      return { sent: false, response: res, queued: false };
    } catch (e) {
      // Falha de rede — enfileira
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
