// Helpers de rascunho persistente de formulários usando IndexedDB.
// Objetivo: permitir que o usuário preencha um form na feira (inclusive offline)
// e não perca nada se a página recarregar, o celular dormir ou a aba for fechada.
//
// Uso típico em componente:
//   const key = `checkin-${eventId}-${boothId}`;
//   useEffect(() => { draftLoad(key).then(...) }, [key]);  // restaurar
//   useEffect(() => { const t = setTimeout(() => draftSave(key, state), 500); return () => clearTimeout(t); }, [state]);  // auto-save debounced
//   await draftClear(key);  // ao submeter com sucesso

import { draftSave, draftLoad, draftClear, draftPruneOld, draftListByPrefix } from './db';
export type { DraftItem } from './db';

export { draftSave, draftLoad, draftClear, draftPruneOld, draftListByPrefix };

/**
 * Gera um id curto unico pra identificar um rascunho novo. Suficiente pra
 * evitar colisao num mesmo dispositivo (timestamp base36 + random).
 */
export function generateDraftId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Converte um File em base64 (data URL completo: `data:image/png;base64,...`).
 * Usado pra salvar fotos no IndexedDB como rascunho.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Converte um data URL (`data:image/png;base64,...`) de volta em File.
 * Usado ao restaurar um rascunho: as fotos salvas em base64 voltam a ser
 * File objects que o form pode submeter normalmente.
 */
export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

/**
 * Retorna uma string amigável com o tempo relativo desde o rascunho.
 * Ex: "há 3 minutos", "há 2 horas", "há 1 dia".
 */
export function formatDraftAge(updatedAt: number): string {
  const diff = Date.now() - updatedAt;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} minuto${min > 1 ? 's' : ''}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} hora${h > 1 ? 's' : ''}`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

// Idade máxima antes de considerar um rascunho "expirado" (14 dias).
// Componentes podem chamar draftPruneOld(DRAFT_MAX_AGE_MS) ao montar
// pra limpar lixo antigo.
export const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
