'use client';

// Avatar do contato (foto da pessoa, foto do cartao, ou iniciais).
// Usado em: contact-card (lista), kanban-card, focus-contact-card,
// ContatosTab do evento, detalhe do contato.
//
// Prioridade:
//   1. contact.avatar_url (coluna dedicada) — walk-in e check-in gravam
//   2. Fallback: iniciais em circulo roxo com gradiente
//
// O parsing de URL a partir de notes ("Foto da pessoa: ...") foi
// substituido pelo backfill na migration 20260413_contacts_avatar_url.

interface ContactAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP: Record<NonNullable<ContactAvatarProps['size']>, { px: string; text: string }> = {
  xs: { px: 'w-5 h-5', text: 'text-[8px]' },
  sm: { px: 'w-7 h-7', text: 'text-[10px]' },
  md: { px: 'w-10 h-10', text: 'text-xs' },
  lg: { px: 'w-12 h-12', text: 'text-sm' },
  xl: { px: 'w-20 h-20', text: 'text-xl' },
};

function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function ContactAvatar({ name, avatarUrl: _avatarUrl, size = 'md', className = '' }: ContactAvatarProps) {
  // avatarUrl ignorado deliberadamente — fotos de contato (do cartao escaneado)
  // foram desligadas pra economizar egress. So avatares de VENDEDOR (profile.avatar_url)
  // continuam aparecendo, e esses sao renderizados direto (nao via este componente).
  const { px, text } = SIZE_MAP[size];
  const base = `${px} rounded-full shrink-0 border border-purple-700/40 ${className}`;

  return (
    <div
      className={`${base} bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold ${text}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
