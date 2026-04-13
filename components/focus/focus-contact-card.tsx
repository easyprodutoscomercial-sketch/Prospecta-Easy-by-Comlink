'use client';

import {
  TEMPERATURA_LABELS,
  TEMPERATURA_COLORS,
  ORIGEM_LABELS,
  INTERACTION_TYPE_LABELS,
  INTERACTION_OUTCOME_LABELS,
} from '@/lib/utils/labels';
import ContactAvatar from '@/components/contacts/contact-avatar';

interface FocusContactCardProps {
  contact: any;
  userMap: Record<string, { name: string; avatar_url?: string | null }>;
  lastInteractions: any[];
}

export default function FocusContactCard({
  contact,
  userMap,
  lastInteractions,
}: FocusContactCardProps) {
  const owner = contact.assigned_to_user_id
    ? userMap[contact.assigned_to_user_id]
    : null;

  return (
    <div className="bg-[#1e0f35] rounded-2xl border border-purple-800/30 p-5 sm:p-6 space-y-5">
      {/* Header: Name + Company */}
      <div className="flex items-start justify-between gap-4">
        <ContactAvatar name={contact.name} avatarUrl={contact.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-neutral-100 truncate">
            {contact.name}
          </h2>
          {contact.company && (
            <p className="text-sm text-purple-300/60 truncate mt-0.5">
              {contact.company}
            </p>
          )}
        </div>

        {/* Owner avatar */}
        {owner && (
          <div className="shrink-0" title={owner.name}>
            {owner.avatar_url ? (
              <img
                src={owner.avatar_url}
                alt={owner.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-800/40"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-purple-700/40 flex items-center justify-center text-xs font-bold text-purple-300">
                {owner.name
                  .split(' ')
                  .map((w: string) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contact info row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {contact.phone && (
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <svg
              className="w-4 h-4 text-purple-400/60 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <span className="truncate">{contact.phone}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <svg
              className="w-4 h-4 text-blue-400/60 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        {contact.whatsapp && (
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <svg
              className="w-4 h-4 text-green-500/60 shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <span className="truncate">{contact.whatsapp}</span>
          </div>
        )}
      </div>

      {/* Badges: temperatura, origem, valor_estimado */}
      <div className="flex items-center gap-2 flex-wrap">
        {contact.temperatura && (
          <span
            className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
              TEMPERATURA_COLORS[contact.temperatura] || 'bg-purple-800/30 text-purple-300/50'
            }`}
          >
            {TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}
          </span>
        )}
        {contact.origem && (
          <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-purple-800/30 text-purple-300/60">
            {ORIGEM_LABELS[contact.origem] || contact.origem}
          </span>
        )}
        {contact.valor_estimado != null && contact.valor_estimado > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-lg font-bold bg-emerald-500/15 text-emerald-400">
            {contact.valor_estimado.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </span>
        )}
      </div>

      {/* Mini pipeline tracker -- show current stage name with a colored dot */}
      {contact.stage_name && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-900/30 border border-purple-800/20">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{
              backgroundColor: contact.stage_color || '#10b981',
            }}
          />
          <span className="text-xs font-semibold text-neutral-200">
            {contact.stage_name}
          </span>
          <span className="text-[10px] text-purple-300/40 ml-1">
            (etapa atual)
          </span>
        </div>
      )}

      {/* Notes */}
      {contact.notes && (
        <div className="px-3 py-2.5 rounded-lg bg-purple-900/20 border border-purple-800/15">
          <p className="text-[10px] font-semibold text-purple-300/40 uppercase tracking-wider mb-1">
            Observacoes
          </p>
          <p className="text-sm text-neutral-300 whitespace-pre-line leading-relaxed">
            {contact.notes}
          </p>
        </div>
      )}

      {/* Quick action links */}
      <div className="flex items-center gap-2">
        {(contact.whatsapp || contact.phone) && (
          <a
            href={`https://wa.me/55${(contact.whatsapp || contact.phone || '').replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Email
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone.replace(/\D/g, '')}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            Ligar
          </a>
        )}
      </div>

      {/* Last 3 interactions */}
      <div>
        <p className="text-[10px] font-semibold text-purple-300/40 uppercase tracking-wider mb-2">
          Ultimas Interacoes
        </p>
        {lastInteractions.length === 0 && (
          <p className="text-xs text-neutral-500 py-3 text-center">
            Nenhuma interacao registrada
          </p>
        )}
        <div className="space-y-2">
          {lastInteractions.slice(0, 3).map((interaction: any) => (
            <div
              key={interaction.id}
              className="flex items-start gap-3 px-3 py-2 rounded-lg bg-purple-900/15 border border-purple-800/15"
            >
              <div className="shrink-0 mt-0.5">
                <span className="inline-flex w-2 h-2 rounded-full bg-purple-500/50" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-neutral-200">
                    {INTERACTION_TYPE_LABELS[interaction.type] || interaction.type}
                  </span>
                  <span className="text-[10px] text-purple-300/40">--</span>
                  <span className="text-xs text-neutral-400">
                    {INTERACTION_OUTCOME_LABELS[interaction.outcome] || interaction.outcome}
                  </span>
                </div>
                <p className="text-[10px] text-purple-300/30 mt-0.5">
                  {new Date(interaction.happened_at).toLocaleString('pt-BR')}
                </p>
                {interaction.note && (
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                    {interaction.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
