'use client';

/**
 * Badges compartilhados — antes cada tela reimplementava o badge de feira,
 * temperatura, tipo. Resultado: o badge de feira aparecia 4 vezes em variantes
 * sutilmente diferentes (rounded vs rounded-md, text-[9px] vs text-[10px],
 * bg-amber-500/10 vs bg-amber-500/15).
 *
 * Use:
 *   <TemperaturaBadge temperatura={contact.temperatura} />
 *   <EventBadge event={contact.event} size="sm" />
 *   <DescartadoBadge />
 */

import Link from 'next/link';
import { TEMPERATURA_LABELS, TEMPERATURA_COLORS, CONTACT_TYPE_LABELS, CONTACT_TYPE_COLORS } from '@/lib/utils/labels';

type Size = 'sm' | 'md';

const sizeCls: Record<Size, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-1 text-xs',
};

// === TEMPERATURA ===
export function TemperaturaBadge({ temperatura, size = 'sm' }: { temperatura: string | null | undefined; size?: Size }) {
  if (!temperatura) return null;
  const color = TEMPERATURA_COLORS[temperatura] || '';
  const label = TEMPERATURA_LABELS[temperatura] || temperatura;
  return (
    <span className={`inline-flex items-center rounded font-semibold ${sizeCls[size]} ${color}`} title={`Temperatura: ${label}`}>
      {label}
    </span>
  );
}

// === TIPO (Fornecedor / Comprador / Ambos) ===
export function TipoBadge({ tipo, size = 'sm' }: { tipo: string; size?: Size }) {
  const color = CONTACT_TYPE_COLORS[tipo] || 'bg-[#2a1245] text-neutral-400';
  const label = CONTACT_TYPE_LABELS[tipo] || tipo;
  return (
    <span className={`inline-flex items-center rounded font-medium ${sizeCls[size]} ${color}`}>
      {label}
    </span>
  );
}

// === DESCARTADO ===
export function DescartadoBadge({ size = 'sm' }: { size?: Size }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded font-medium ${sizeCls[size]} bg-red-500/20 text-red-400`}>
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      Descartado
    </span>
  );
}

// === EVENTO / FEIRA ===
export function EventBadge({
  event,
  size = 'sm',
  asLink = true,
}: {
  event: { id: string; name: string; cover_image_url?: string | null } | null | undefined;
  size?: Size;
  asLink?: boolean;
}) {
  if (!event) return null;
  const cls = `inline-flex items-center gap-1 rounded font-bold ${sizeCls[size]} bg-amber-500/15 text-amber-300 border border-amber-500/30 max-w-[160px]`;
  const content = (
    <>
      <span className="truncate">{event.name}</span>
    </>
  );
  if (asLink) {
    return (
      <Link
        href={`/eventos/${event.id}`}
        onClick={(e) => e.stopPropagation()}
        className={`${cls} hover:bg-amber-500/25 transition-colors`}
        title={`Feira: ${event.name}`}
      >
        {content}
      </Link>
    );
  }
  return (
    <span className={cls} title={`Feira: ${event.name}`}>
      {content}
    </span>
  );
}
