'use client';

import Link from 'next/link';
import { Contact, PipelineStage } from '@/lib/types';
import { formatStatus, getStatusColor, CONTACT_TYPE_LABELS, CONTACT_TYPE_COLORS, TEMPERATURA_LABELS, TEMPERATURA_COLORS, ORIGEM_LABELS, CLASSE_LABELS, resolveTipoDisplay } from '@/lib/utils/labels';
import { getUserColor, getUserInitials } from '@/lib/utils/user-colors';
import ContactMiniPipeline from '@/components/contacts/contact-mini-pipeline';
import ContactAvatar from '@/components/contacts/contact-avatar';
import type { DensityMode } from '@/lib/hooks/use-contact-preferences';

interface UserInfo {
  user_id: string;
  name: string;
  color: { bg: string; text: string };
  avatar_url?: string | null;
}

interface ContactCardProps {
  contact: Contact;
  densityMode: DensityMode;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onHide: (id: string) => void;
  onClaim: (id: string) => void;
  onToggleInexistente?: (id: string) => void;
  onDelete?: (id: string) => void;
  owner: UserInfo | undefined;
  ownerColor: { bg: string; text: string } | null;
  currentUserId: string;
  currentPipelineStages: PipelineStage[] | null;
}

export default function ContactCard({
  contact,
  densityMode,
  isSelected,
  onToggleSelect,
  onHide,
  onClaim,
  onToggleInexistente,
  onDelete,
  owner,
  ownerColor,
  currentUserId,
  currentPipelineStages,
}: ContactCardProps) {
  const isUnassigned = !contact.assigned_to_user_id;
  const isInexistente = contact.inexistente === true;

  // ---------- COMPACT MODE ----------
  if (densityMode === 'compact') {
    return (
      <div className={`group bg-[#1e0f35] rounded-lg border transition-all ${isInexistente ? 'opacity-60' : ''} ${isSelected ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-purple-800/30 hover:border-purple-600/40'}`}>
        <div className="p-2 flex items-center gap-2">
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(contact.id)} className="rounded border-neutral-600 bg-[#2a1245] text-emerald-500 focus:ring-emerald-500 shrink-0" />

          <ContactAvatar name={contact.name} avatarUrl={contact.avatar_url} size="sm" />

          <Link href={`/contacts/${contact.id}`} className={`text-xs font-semibold hover:text-emerald-400 transition-colors truncate flex-1 min-w-0 ${isInexistente ? 'line-through text-neutral-500' : 'text-white'}`}>
            {contact.name}
          </Link>
          {isInexistente && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-500/20 text-red-400 whitespace-nowrap shrink-0">Inexistente</span>
          )}

          {contact.event && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 whitespace-nowrap shrink-0 max-w-[120px]" title={`Feira: ${contact.event.name}`}>
              {contact.event.cover_image_url && (
                <img src={contact.event.cover_image_url} alt="" className="w-3 h-3 rounded object-cover" />
              )}
              <span className="truncate">{contact.event.name}</span>
            </span>
          )}

          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap shrink-0 ${getStatusColor(contact.status)}`}>
            {formatStatus(contact.status)}
          </span>

          {/* Small avatar */}
          {!isUnassigned && (
            <div className="shrink-0 w-6 h-6 rounded-full overflow-hidden" title={owner?.name}>
              {owner?.avatar_url ? (
                <img src={owner.avatar_url} alt={owner.name} className="w-6 h-6 object-cover rounded-full" />
              ) : (
                <div className="w-6 h-6 flex items-center justify-center text-[9px] font-bold rounded-full"
                  style={{ backgroundColor: ownerColor?.bg || '#404040', color: ownerColor?.text || '#fff' }}>
                  {owner ? getUserInitials(owner.name) : '?'}
                </div>
              )}
            </div>
          )}

          {/* Inexistente toggle button */}
          {onToggleInexistente && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleInexistente(contact.id); }}
              className={`shrink-0 p-1 transition-colors ${isInexistente ? 'text-red-400 hover:text-neutral-400' : 'text-neutral-600 hover:text-red-400'}`}
              title={isInexistente ? 'Remover marca de inexistente' : 'Marcar como inexistente'}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </button>
          )}

          {/* Hide button - always visible in compact */}
          <button
            onClick={(e) => { e.stopPropagation(); onHide(contact.id); }}
            className="shrink-0 p-1 text-neutral-600 hover:text-amber-400 transition-colors"
            title="Ocultar contato (só para você)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
            </svg>
          </button>
          {/* Delete button - admin only */}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(contact.id); }}
              className="shrink-0 p-1 text-neutral-600 hover:text-red-500 transition-colors"
              title="Deletar contato permanentemente"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------- NORMAL MODE ----------
  if (densityMode === 'normal') {
    return (
      <div className={`group bg-[#1e0f35] rounded-xl border card-hover transition-all ${isInexistente ? 'opacity-60' : ''} ${isSelected ? 'border-emerald-500 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-900/10' : 'border-purple-800/30 hover:border-purple-600/40'}`}>
        <div className="p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(contact.id)} className="mt-1 rounded border-neutral-600 bg-[#2a1245] text-emerald-500 focus:ring-emerald-500 shrink-0" />
            <ContactAvatar name={contact.name} avatarUrl={contact.avatar_url} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/contacts/${contact.id}`} className={`text-sm font-semibold hover:text-emerald-400 transition-colors truncate ${isInexistente ? 'line-through text-neutral-500' : 'text-white'}`}>
                  {contact.name}
                </Link>
                {isInexistente && (
                  <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-500/20 text-red-400">Inexistente</span>
                )}
                {resolveTipoDisplay(contact.tipo).map((t) => (
                  <span key={t} className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${CONTACT_TYPE_COLORS[t] || 'bg-[#2a1245] text-neutral-400'}`}>
                    {CONTACT_TYPE_LABELS[t] || t}
                  </span>
                ))}
                {contact.temperatura && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>
                    {TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}
                  </span>
                )}
                {contact.event && (
                  <Link
                    href={`/eventos/${contact.event.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 hover:bg-amber-500/25 max-w-[160px]"
                    title={`Feira: ${contact.event.name}`}
                  >
                    {contact.event.cover_image_url && (
                      <img src={contact.event.cover_image_url} alt="" className="w-3.5 h-3.5 rounded object-cover" />
                    )}
                    <span className="truncate">{contact.event.name}</span>
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 mt-2 text-xs">
                <div>
                  <span className="text-purple-300 text-[10px] font-bold uppercase tracking-wider">Empresa</span>
                  <p className="text-neutral-200 truncate">{contact.company || <span className="text-neutral-600">-</span>}</p>
                </div>
                <div>
                  <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Email</span>
                  <p className="text-neutral-200 truncate">{contact.email || <span className="text-neutral-600">-</span>}</p>
                </div>
                <div>
                  <span className="text-purple-300 text-[10px] font-bold uppercase tracking-wider">Telefone</span>
                  <p className="text-neutral-200">{contact.phone || <span className="text-neutral-600">-</span>}</p>
                </div>
                <div>
                  <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Data</span>
                  <p className="text-neutral-200">{new Date(contact.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {currentPipelineStages && currentPipelineStages.length > 0 && (
                <ContactMiniPipeline stages={currentPipelineStages} currentStageId={contact.stage_id} />
              )}
            </div>

            {/* Right: status + responsavel + hide */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-1">
                <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full whitespace-nowrap ${getStatusColor(contact.status)}`}>
                  {formatStatus(contact.status)}
                </span>
                {/* Inexistente toggle button */}
                {onToggleInexistente && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleInexistente(contact.id); }}
                    className={`p-1 opacity-0 group-hover:opacity-100 transition-all ${isInexistente ? 'text-red-400 hover:text-neutral-400 !opacity-100' : 'text-neutral-600 hover:text-red-400'}`}
                    title={isInexistente ? 'Remover marca de inexistente' : 'Marcar como inexistente'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </button>
                )}
                {/* Hide button - visible on hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); onHide(contact.id); }}
                  className="p-1 text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-amber-400 transition-all"
                  title="Ocultar contato (só para você)"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                </button>
                {/* Delete button - admin only */}
                {onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(contact.id); }}
                    className="p-1 text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                    title="Deletar contato permanentemente"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {isUnassigned ? (
                currentUserId ? (
                  <button onClick={(e) => { e.stopPropagation(); onClaim(contact.id); }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30 rounded-full hover:bg-emerald-500/10 hover:border-emerald-400 transition-all"
                    title="Apontar para mim">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Apontar
                  </button>
                ) : (
                  <span className="text-[10px] text-neutral-600">Sem resp.</span>
                )
              ) : (
                <div className="flex items-center gap-2" title={owner?.name || 'Responsavel'}>
                  <div className="avatar-breathe shrink-0 w-9 h-9 rounded-full overflow-hidden">
                    {owner?.avatar_url ? (
                      <img src={owner.avatar_url} alt={owner.name} className="w-9 h-9 object-cover rounded-full" />
                    ) : (
                      <div className="w-9 h-9 flex items-center justify-center text-xs font-bold rounded-full"
                        style={{ backgroundColor: ownerColor?.bg || '#404040', color: ownerColor?.text || '#fff' }}>
                        {owner ? getUserInitials(owner.name) : '?'}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-400 max-w-[80px] truncate hidden sm:inline">{owner?.name || '...'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- EXPANDED MODE ----------
  return (
    <div className={`group bg-[#1e0f35] rounded-xl border card-hover transition-all ${isInexistente ? 'opacity-60' : ''} ${isSelected ? 'border-emerald-500 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-900/10' : 'border-purple-800/30 hover:border-purple-600/40'}`}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(contact.id)} className="mt-1 rounded border-neutral-600 bg-[#2a1245] text-emerald-500 focus:ring-emerald-500 shrink-0" />
          <ContactAvatar name={contact.name} avatarUrl={contact.avatar_url} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/contacts/${contact.id}`} className={`text-base font-semibold hover:text-emerald-400 transition-colors truncate ${isInexistente ? 'line-through text-neutral-500' : 'text-white'}`}>
                {contact.name}
              </Link>
              {isInexistente && (
                <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-500/20 text-red-400">Inexistente</span>
              )}
              {contact.tipo?.map((t) => (
                <span key={t} className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${CONTACT_TYPE_COLORS[t] || 'bg-[#2a1245] text-neutral-400'}`}>
                  {CONTACT_TYPE_LABELS[t] || t}
                </span>
              ))}
              {contact.temperatura && (
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>
                  {TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}
                </span>
              )}
              {contact.event && (
                <Link
                  href={`/eventos/${contact.event.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 hover:bg-amber-500/25 max-w-[180px]"
                  title={`Feira: ${contact.event.name}`}
                >
                  {contact.event.cover_image_url && (
                    <img src={contact.event.cover_image_url} alt="" className="w-3.5 h-3.5 rounded object-cover" />
                  )}
                  <span className="truncate">{contact.event.name}</span>
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 mt-2 text-xs">
              <div>
                <span className="text-purple-300 text-[10px] font-bold uppercase tracking-wider">Empresa</span>
                <p className="text-neutral-200 truncate">{contact.company || <span className="text-neutral-600">-</span>}</p>
              </div>
              <div>
                <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Email</span>
                <p className="text-neutral-200 truncate">{contact.email || <span className="text-neutral-600">-</span>}</p>
              </div>
              <div>
                <span className="text-purple-300 text-[10px] font-bold uppercase tracking-wider">Telefone</span>
                <p className="text-neutral-200">{contact.phone || <span className="text-neutral-600">-</span>}</p>
              </div>
              <div>
                <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Data</span>
                <p className="text-neutral-200">{new Date(contact.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            {/* Extra row for expanded mode */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 mt-2 text-xs">
              <div>
                <span className="text-purple-300 text-[10px] font-bold uppercase tracking-wider">Cidade/UF</span>
                <p className="text-neutral-200 truncate">
                  {contact.cidade || contact.estado
                    ? `${contact.cidade || ''}${contact.cidade && contact.estado ? '/' : ''}${contact.estado || ''}`
                    : <span className="text-neutral-600">-</span>}
                </p>
              </div>
              <div>
                <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">WhatsApp</span>
                <p className="text-neutral-200 truncate">{contact.whatsapp || <span className="text-neutral-600">-</span>}</p>
              </div>
              <div>
                <span className="text-purple-300 text-[10px] font-bold uppercase tracking-wider">Classe</span>
                <p className="text-neutral-200">{contact.classe ? CLASSE_LABELS[contact.classe] || contact.classe : <span className="text-neutral-600">-</span>}</p>
              </div>
              <div>
                <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Origem</span>
                <p className="text-neutral-200">{contact.origem ? ORIGEM_LABELS[contact.origem] || contact.origem : <span className="text-neutral-600">-</span>}</p>
              </div>
            </div>

            {/* Notes + valor estimado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-2 text-xs">
              {contact.notes && (
                <div>
                  <span className="text-purple-300 text-[10px] font-bold uppercase tracking-wider">Notas</span>
                  <p className="text-neutral-400 truncate">{contact.notes.slice(0, 100)}{contact.notes.length > 100 ? '...' : ''}</p>
                </div>
              )}
              {contact.valor_estimado != null && contact.valor_estimado > 0 && (
                <div>
                  <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Valor Estimado</span>
                  <p className="text-emerald-300 font-semibold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contact.valor_estimado)}
                  </p>
                </div>
              )}
            </div>

            {currentPipelineStages && currentPipelineStages.length > 0 && (
              <ContactMiniPipeline stages={currentPipelineStages} currentStageId={contact.stage_id} />
            )}
          </div>

          {/* Right: status + responsavel + hide */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full whitespace-nowrap ${getStatusColor(contact.status)}`}>
                {formatStatus(contact.status)}
              </span>
              {/* Inexistente toggle button */}
              {onToggleInexistente && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleInexistente(contact.id); }}
                  className={`p-1 opacity-0 group-hover:opacity-100 transition-all ${isInexistente ? 'text-red-400 hover:text-neutral-400 !opacity-100' : 'text-neutral-600 hover:text-red-400'}`}
                  title={isInexistente ? 'Remover marca de inexistente' : 'Marcar como inexistente'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onHide(contact.id); }}
                className="p-1 text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                title="Ocultar contato"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              </button>
            </div>

            {isUnassigned ? (
              currentUserId ? (
                <button onClick={(e) => { e.stopPropagation(); onClaim(contact.id); }}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30 rounded-full hover:bg-emerald-500/10 hover:border-emerald-400 transition-all"
                  title="Apontar para mim">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Apontar
                </button>
              ) : (
                <span className="text-[10px] text-neutral-600">Sem resp.</span>
              )
            ) : (
              <div className="flex items-center gap-2" title={owner?.name || 'Responsavel'}>
                <div className="avatar-breathe shrink-0 w-9 h-9 rounded-full overflow-hidden">
                  {owner?.avatar_url ? (
                    <img src={owner.avatar_url} alt={owner.name} className="w-9 h-9 object-cover rounded-full" />
                  ) : (
                    <div className="w-9 h-9 flex items-center justify-center text-xs font-bold rounded-full"
                      style={{ backgroundColor: ownerColor?.bg || '#404040', color: ownerColor?.text || '#fff' }}>
                      {owner ? getUserInitials(owner.name) : '?'}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-neutral-400 max-w-[80px] truncate hidden sm:inline">{owner?.name || '...'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
