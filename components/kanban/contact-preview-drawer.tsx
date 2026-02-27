'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Contact, Interaction, PipelineStage } from '@/lib/types';
import type { UserInfo } from './kanban-card';
import ContactPipelineTracker from '@/components/contacts/contact-pipeline-tracker';
import {
  TEMPERATURA_LABELS,
  TEMPERATURA_COLORS,
  CONTACT_TYPE_LABELS,
  CONTACT_TYPE_COLORS,
  ORIGEM_LABELS,
  CLASSE_LABELS,
  INTERACTION_TYPE_LABELS,
  INTERACTION_OUTCOME_LABELS,
  ACTIVITY_TEMPLATES,
  formatInteractionType,
} from '@/lib/utils/labels';

interface ContactPreviewDrawerProps {
  contactId: string | null;
  onClose: () => void;
  userMap: Record<string, UserInfo>;
  stages: PipelineStage[];
  pipelineName: string;
  onJumpForward?: (contactId: string) => void;
  onJumpBackward?: (contactId: string) => void;
  onScheduleMeeting?: (contactId: string, contactName: string) => void;
  onClaimContact?: (contactId: string) => void;
  onRequestContact?: (contactId: string) => void;
  currentUserId?: string;
  onInteractionAdded?: () => void;
}

interface InteractionDisplay {
  id: string;
  type: string;
  outcome?: string;
  note: string | null;
  happened_at: string;
  created_by_name: string;
}

export default function ContactPreviewDrawer({
  contactId,
  onClose,
  userMap,
  stages,
  pipelineName,
  onJumpForward,
  onJumpBackward,
  onScheduleMeeting,
  onClaimContact,
  onRequestContact,
  currentUserId,
  onInteractionAdded,
}: ContactPreviewDrawerProps) {
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<InteractionDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const isOpen = !!contactId;

  // Interaction form state
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('LIGACAO');
  const [formOutcome, setFormOutcome] = useState('SEM_RESPOSTA');
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch contact details + interactions
  const fetchDrawerData = useCallback((cId: string) => {
    setLoading(true);
    Promise.all([
      fetch(`/api/contacts/${cId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/interactions?contact_id=${cId}&limit=5`).then(r => r.ok ? r.json() : null),
    ]).then(([contactData, intData]) => {
      if (contactData) setContact(contactData);
      if (intData?.interactions) setInteractions(intData.interactions.slice(0, 5));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!contactId) { setContact(null); setInteractions([]); setShowForm(false); return; }
    fetchDrawerData(contactId);
  }, [contactId, fetchDrawerData]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleStageClick = useCallback((stage: PipelineStage) => {
    // no-op in preview, show only
  }, []);

  // Submit interaction (quick template or form)
  async function submitInteraction(type: string, outcome: string, note: string) {
    if (!contact) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contact.id, type, outcome, note: note || undefined }),
      });
      if (!res.ok) throw new Error();
      // Refresh interactions list
      const intRes = await fetch(`/api/interactions?contact_id=${contact.id}&limit=5`);
      if (intRes.ok) {
        const intData = await intRes.json();
        setInteractions((intData.interactions || []).slice(0, 5));
      }
      // Reset form
      setFormNote('');
      setShowForm(false);
      // Notify parent to refresh board
      onInteractionAdded?.();
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  }

  const isUnassigned = contact ? !contact.assigned_to_user_id : false;
  const owner = contact ? userMap[contact.assigned_to_user_id || contact.created_by_user_id] : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } bg-black/20 sm:bg-black/20 backdrop-blur-[2px]`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full z-50 w-full sm:w-[480px] bg-[#120826] border-l border-purple-800/20 shadow-2xl shadow-purple-900/40 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-purple-800/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && contact && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-purple-800/20 bg-[#160b2e]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">{contact.name}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {contact.company && (
                      <span className="text-xs text-purple-300/50">{contact.company}</span>
                    )}
                    {contact.tipo?.map(t => (
                      <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CONTACT_TYPE_COLORS[t] || 'bg-purple-800/30 text-purple-300/50'}`}>
                        {CONTACT_TYPE_LABELS[t] || t}
                      </span>
                    ))}
                    {contact.temperatura && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>
                        {TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}
                      </span>
                    )}
                  </div>
                  {contact.valor_estimado != null && contact.valor_estimado > 0 && (
                    <p className="text-sm font-bold text-emerald-400 mt-1">
                      {contact.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { router.push(`/contacts/${contact.id}`); onClose(); }}
                    className="text-[10px] font-medium text-purple-300/50 hover:text-emerald-400 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-500/10"
                  >
                    Abrir pagina
                  </button>
                  <button onClick={onClose} className="text-purple-400/50 hover:text-purple-300 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Pipeline Tracker */}
              {stages.length > 0 && (
                <div>
                  <ContactPipelineTracker
                    pipelineName={pipelineName}
                    stages={stages}
                    currentStageId={contact.stage_id}
                    onStageClick={handleStageClick}
                    disabled
                  />
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <h3 className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium mb-2">Acoes rapidas</h3>
                <div className="flex items-center gap-2">
                  {(contact.whatsapp || contact.phone) && (
                    <a
                      href={`https://wa.me/55${(contact.whatsapp || contact.phone || '').replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </a>
                  )}
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      Email
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone.replace(/\D/g, '')}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      Ligar
                    </a>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium mb-2">Informacoes</h3>
                <div className="bg-[#1e0f35]/80 rounded-xl p-3 space-y-2 border border-purple-800/15">
                  {contact.phone && (
                    <InfoRow label="Telefone" value={contact.phone} />
                  )}
                  {contact.email && (
                    <InfoRow label="Email" value={contact.email} />
                  )}
                  {contact.whatsapp && (
                    <InfoRow label="WhatsApp" value={contact.whatsapp} />
                  )}
                  {contact.company && (
                    <InfoRow label="Empresa" value={contact.company} />
                  )}
                  {contact.cpf && (
                    <InfoRow label="CPF" value={contact.cpf} />
                  )}
                  {contact.cnpj && (
                    <InfoRow label="CNPJ" value={contact.cnpj} />
                  )}
                  {contact.origem && (
                    <InfoRow label="Origem" value={ORIGEM_LABELS[contact.origem] || contact.origem} />
                  )}
                  {contact.classe && (
                    <InfoRow label="Classe" value={CLASSE_LABELS[contact.classe] || contact.classe} />
                  )}
                  {contact.referencia && (
                    <InfoRow label="Referencia" value={contact.referencia} />
                  )}
                  {contact.cidade && (
                    <InfoRow label="Cidade" value={`${contact.cidade}${contact.estado ? ` - ${contact.estado}` : ''}`} />
                  )}
                  {contact.endereco && (
                    <InfoRow label="Endereco" value={`${contact.endereco}${contact.cep ? ` - ${contact.cep}` : ''}`} />
                  )}
                  {contact.website && (
                    <InfoRow label="Website" value={contact.website} />
                  )}
                  {contact.instagram && (
                    <InfoRow label="Instagram" value={contact.instagram} />
                  )}
                  {contact.contato_nome && (
                    <InfoRow label="Contato" value={`${contact.contato_nome}${contact.cargo ? ` (${contact.cargo})` : ''}`} />
                  )}
                  {owner && (
                    <InfoRow label="Responsavel" value={owner.name} />
                  )}
                  {isUnassigned && (
                    <InfoRow label="Responsavel" value="Sem responsavel" dimmed />
                  )}
                  <InfoRow
                    label="Criado em"
                    value={new Date(contact.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  />
                  {contact.notes && (
                    <div className="pt-1 border-t border-purple-800/10">
                      <span className="text-[10px] text-purple-300/40 font-medium">Notas</span>
                      <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-3 whitespace-pre-line">{contact.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Register Interaction */}
              <div>
                <h3 className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium mb-2">Registrar interacao</h3>

                {/* Quick templates */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {ACTIVITY_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      disabled={submitting}
                      onClick={() => submitInteraction(tpl.type, tpl.outcome, tpl.note)}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#1e0f35]/80 border border-purple-800/15 text-purple-300/70 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>

                {/* Expandable form */}
                <button
                  onClick={() => setShowForm(f => !f)}
                  className="text-[10px] font-medium text-purple-300/50 hover:text-purple-300 transition-colors flex items-center gap-1"
                >
                  <svg className={`w-3 h-3 transition-transform ${showForm ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Formulario completo
                </button>

                {showForm && (
                  <div className="mt-2 bg-[#1e0f35]/80 rounded-xl p-3 space-y-3 border border-purple-800/15">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-purple-300/40 font-medium mb-1 block">Tipo</label>
                        <select
                          value={formType}
                          onChange={(e) => setFormType(e.target.value)}
                          className="w-full text-xs bg-[#2a1245] border border-purple-700/30 rounded-lg px-2 py-1.5 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        >
                          {Object.entries(INTERACTION_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-purple-300/40 font-medium mb-1 block">Resultado</label>
                        <select
                          value={formOutcome}
                          onChange={(e) => setFormOutcome(e.target.value)}
                          className="w-full text-xs bg-[#2a1245] border border-purple-700/30 rounded-lg px-2 py-1.5 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        >
                          {Object.entries(INTERACTION_OUTCOME_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-purple-300/40 font-medium mb-1 block">Notas</label>
                      <textarea
                        value={formNote}
                        onChange={(e) => setFormNote(e.target.value)}
                        rows={2}
                        placeholder="Detalhes da interacao..."
                        className="w-full text-xs bg-[#2a1245] border border-purple-700/30 rounded-lg px-2 py-1.5 text-neutral-200 placeholder:text-purple-300/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                      />
                    </div>
                    <button
                      onClick={() => submitInteraction(formType, formOutcome, formNote)}
                      disabled={submitting}
                      className="w-full text-xs font-bold py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Registrar
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Recent Interactions */}
              <div>
                <h3 className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium mb-2">Interacoes recentes</h3>
                {interactions.length === 0 ? (
                  <p className="text-xs text-purple-300/30">Nenhuma interacao</p>
                ) : (
                  <div className="space-y-2">
                    {interactions.map((int) => (
                      <div key={int.id} className="bg-[#1e0f35]/80 rounded-lg p-2.5 border border-purple-800/15">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-purple-300/70">{formatInteractionType(int.type)}</span>
                          <span className="text-[9px] text-purple-300/30">
                            {new Date(int.happened_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                        {int.note && (
                          <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">{int.note}</p>
                        )}
                        <p className="text-[9px] text-purple-300/25 mt-1">{int.created_by_name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 px-5 py-3 border-t border-purple-800/20 bg-[#160b2e] flex items-center gap-2 flex-wrap">
              {onJumpBackward && (
                <button
                  onClick={() => { onJumpBackward(contact.id); onClose(); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-red-400/60 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar
                </button>
              )}
              {onJumpForward && (
                <button
                  onClick={() => { onJumpForward(contact.id); onClose(); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Avancar
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              {onScheduleMeeting && (
                <button
                  onClick={() => { onScheduleMeeting(contact.id, contact.name); onClose(); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-cyan-400/60 hover:text-cyan-400 hover:bg-cyan-500/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Reuniao
                </button>
              )}
              <div className="flex-1" />
              {isUnassigned && onClaimContact && (
                <button
                  onClick={() => { onClaimContact(contact.id); onClose(); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-purple-300/60 hover:text-emerald-400 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Apontar para mim
                </button>
              )}
              {!isUnassigned && currentUserId && contact.assigned_to_user_id !== currentUserId && onRequestContact && (
                <button
                  onClick={() => { onRequestContact(contact.id); onClose(); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Pegar cliente
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function InfoRow({ label, value, dimmed }: { label: string; value: string; dimmed?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-purple-300/40 font-medium">{label}</span>
      <span className={`text-xs text-right max-w-[60%] ${dimmed ? 'text-purple-300/25 italic' : 'text-neutral-300'}`}>{value}</span>
    </div>
  );
}
