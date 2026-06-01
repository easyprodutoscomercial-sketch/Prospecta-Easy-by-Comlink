/**
 * Constroi URL de thumbnail usando Supabase Storage Transformation.
 *
 * Por que existe: o egress free do Supabase eh 5GB/mes. Cada foto de
 * check-in original tem 200KB-800KB. Listas de evento mostram 10-50 fotos
 * por vez em thumbs de 96x72 — sem transform, o vendedor baixa todas em
 * tamanho cheio. Estourou cota uma vez e vai estourar de novo.
 *
 * Solucao: passar `?width=N&quality=70` na URL publica faz o Supabase
 * gerar a versao reduzida no servidor e cachear. Cota free permite
 * transformacoes simples ate 100/mes — em uma feira normal isso eh pouco.
 *
 * Uso:
 *   <img src={thumbUrl(visit.photo_facade_url, 200)} alt="..." />
 *   <a href={visit.photo_facade_url}> (sem thumb, abre fullsize)
 */
export function thumbUrl(url: string | null | undefined, width: number = 200, quality: number = 70): string {
  if (!url) return '';
  // Storage transformation so funciona em URLs publicas do bucket
  // (/storage/v1/object/public/...). Se vier outra forma, devolve crua.
  if (!url.includes('/storage/v1/object/public/')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${width}&quality=${quality}&resize=cover`;
}

export function avatarUrl(url: string | null | undefined): string {
  return thumbUrl(url, 96, 75);
}
