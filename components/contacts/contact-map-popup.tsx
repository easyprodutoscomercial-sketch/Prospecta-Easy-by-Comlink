'use client';

import { Contact } from '@/lib/types';

interface ContactMapPopupProps {
  contact: Contact;
}

const STATUS_COLORS_INLINE: Record<string, { bg: string; text: string }> = {
  NOVO: { bg: '#404040', text: '#d4d4d4' },
  EM_PROSPECCAO: { bg: '#92400e', text: '#fbbf24' },
  CONTATADO: { bg: '#1e3a5f', text: '#60a5fa' },
  REUNIAO_MARCADA: { bg: '#064e3b', text: '#34d399' },
  CONVERTIDO: { bg: '#064e3b', text: '#10b981' },
  PERDIDO: { bg: '#7f1d1d', text: '#f87171' },
};

const STATUS_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  EM_PROSPECCAO: 'Em Prospecao',
  CONTATADO: 'Contatado',
  REUNIAO_MARCADA: 'Reuniao Marcada',
  CONVERTIDO: 'Convertido',
  PERDIDO: 'Perdido',
};

export default function ContactMapPopup({ contact }: ContactMapPopupProps) {
  const statusColor = STATUS_COLORS_INLINE[contact.status] || STATUS_COLORS_INLINE.NOVO;

  return (
    <div style={{ minWidth: 200, maxWidth: 260, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.name}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
          backgroundColor: statusColor.bg, color: statusColor.text, whiteSpace: 'nowrap',
        }}>
          {STATUS_LABELS[contact.status] || contact.status}
        </span>
      </div>

      {contact.company && (
        <div style={{ fontSize: 11, color: '#a78bfa', marginBottom: 4 }}>
          {contact.company}
        </div>
      )}

      <div style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 2 }}>
        {contact.cidade}{contact.cidade && contact.estado ? '/' : ''}{contact.estado}
      </div>

      {contact.phone && (
        <div style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 2 }}>
          Tel: {contact.phone}
        </div>
      )}

      {contact.email && (
        <div style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.email}
        </div>
      )}

      <a
        href={`/contacts/${contact.id}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 600, color: '#10b981', textDecoration: 'none',
          marginTop: 4,
        }}
      >
        Ver detalhes
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}
