'use client';

import { useState, useEffect } from 'react';
import { Contact, PipelineStage, TelefoneAdicional } from '@/lib/types';
import {
  formatStatus,
  getStatusColor,
  CONTACT_TYPE_LABELS,
  CONTACT_TYPE_COLORS,
  TEMPERATURA_LABELS,
  TEMPERATURA_COLORS,
  CLASSE_LABELS,
  ORIGEM_LABELS,
} from '@/lib/utils/labels';
import ContactPipelineTracker from './contact-pipeline-tracker';

interface ContactSidebarProps {
  contact: Contact;
  ownerName: string;
  ownerAvatarUrl: string | null;
  currentUser: { user_id: string; role: string; name: string } | null;
  onStatusChange: (status: string) => void;
  onTerminalStageClick?: (stageId: string, terminalType: 'won' | 'lost') => void;
  onEdit: () => void;
  onDelete: () => void;
  onClaim: () => void;
  onRequestAccess: () => void;
  onUnassign?: () => void;
  onToggleInexistente?: () => void;
  onUpdatePhones?: (telefones: TelefoneAdicional[]) => void;
  claimingContact: boolean;
  requestingAccess: boolean;
  pendingAccessRequest: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function extractDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export default function ContactSidebar({
  contact,
  ownerName,
  ownerAvatarUrl,
  currentUser,
  onStatusChange,
  onTerminalStageClick,
  onEdit,
  onDelete,
  onClaim,
  onRequestAccess,
  onUnassign,
  onToggleInexistente,
  onUpdatePhones,
  claimingContact,
  requestingAccess,
  pendingAccessRequest,
}: ContactSidebarProps) {
  const isAdmin = currentUser?.role === 'admin';
  const canModify = !!currentUser;
  const isOtherOwner = false;

  // Load pipeline stages + name for this contact's pipeline
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [pipelineName, setPipelineName] = useState<string>('');

  // Inline edit phone/whatsapp
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingWhatsapp, setEditingWhatsapp] = useState(false);
  const [phoneValue, setPhoneValue] = useState(contact.phone || '');
  const [whatsappValue, setWhatsappValue] = useState(contact.whatsapp || '');
  const [savingField, setSavingField] = useState(false);

  useEffect(() => {
    setPhoneValue(contact.phone || '');
    setWhatsappValue(contact.whatsapp || '');
  }, [contact.phone, contact.whatsapp]);

  const saveField = async (field: 'phone' | 'whatsapp', value: string) => {
    setSavingField(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      });
      if (!res.ok) {
        // revert on failure
        if (field === 'phone') setPhoneValue(contact.phone || '');
        else setWhatsappValue(contact.whatsapp || '');
      }
    } catch {
      if (field === 'phone') setPhoneValue(contact.phone || '');
      else setWhatsappValue(contact.whatsapp || '');
    }
    setSavingField(false);
    if (field === 'phone') setEditingPhone(false);
    else setEditingWhatsapp(false);
  };

  // Telefones adicionais state
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newNomeContato, setNewNomeContato] = useState('');
  const [newCorreto, setNewCorreto] = useState(true);
  const [savingPhones, setSavingPhones] = useState(false);

  const telefones = contact.telefones_adicionais || [];

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handleAddPhone = async () => {
    if (!newPhone.trim() || !onUpdatePhones) return;
    setSavingPhones(true);
    const updated = [...telefones, { phone: newPhone.trim(), nome_contato: newNomeContato.trim(), correto: newCorreto }];
    await onUpdatePhones(updated);
    setNewPhone('');
    setNewNomeContato('');
    setNewCorreto(true);
    setShowAddPhone(false);
    setSavingPhones(false);
  };

  const handleRemovePhone = async (index: number) => {
    if (!onUpdatePhones) return;
    setSavingPhones(true);
    const updated = telefones.filter((_, i) => i !== index);
    await onUpdatePhones(updated);
    setSavingPhones(false);
  };

  const handleToggleCorreto = async (index: number) => {
    if (!onUpdatePhones) return;
    setSavingPhones(true);
    const updated = telefones.map((t, i) => i === index ? { ...t, correto: !t.correto } : t);
    await onUpdatePhones(updated);
    setSavingPhones(false);
  };

  useEffect(() => {
    if (contact.pipeline_id) {
      fetch(`/api/pipelines/${contact.pipeline_id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.stages) {
            setPipelineStages(data.stages);
          }
          if (data?.name) {
            setPipelineName(data.name);
          }
        })
        .catch(() => {});
    }
  }, [contact.pipeline_id]);

  const handleStageClick = (stage: PipelineStage) => {
    if (stage.is_terminal && stage.terminal_type && onTerminalStageClick) {
      onTerminalStageClick(stage.id, stage.terminal_type);
    } else {
      onStatusChange(stage.id);
    }
  };

  return (
    <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5 space-y-5 shadow-xl shadow-purple-900/20">
      {/* Name + Type badges */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h1 className={`text-lg font-bold ${contact.inexistente ? 'line-through text-neutral-500' : 'text-emerald-400'}`}>{contact.name}</h1>
          {contact.inexistente && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-400">Inexistente</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {contact.tipo?.map((t) => (
            <span key={t} className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${CONTACT_TYPE_COLORS[t] || 'bg-[#2a1245] text-neutral-400'}`}>
              {CONTACT_TYPE_LABELS[t] || t}
            </span>
          ))}
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>
          {formatStatus(contact.status)}
        </span>
      </div>

      {/* Pipeline tracker / Status selector */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-purple-300/60 font-semibold mb-1.5">Pipeline</p>
        {pipelineStages.length > 0 ? (
          <ContactPipelineTracker
            pipelineName={pipelineName}
            stages={pipelineStages}
            currentStageId={contact.stage_id}
            onStageClick={handleStageClick}
            disabled={!!isOtherOwner}
          />
        ) : (
          <select
            value={contact.status}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={!!isOtherOwner}
            className={`w-full px-3 py-1.5 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isOtherOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <option value="NOVO">Novo</option>
            <option value="EM_PROSPECCAO">Em Prospecao</option>
            <option value="CONTATADO">Contatado</option>
            <option value="REUNIAO_MARCADA">Reuniao Marcada</option>
            <option value="CONVERTIDO">Convertido</option>
            <option value="PERDIDO">Perdido</option>
          </select>
        )}
      </div>

      {/* Valor Estimado */}
      {contact.valor_estimado != null && contact.valor_estimado > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-widest text-emerald-400/60 font-semibold mb-1">Valor Estimado</p>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(contact.valor_estimado)}</p>
        </div>
      )}

      {/* Quick Actions: WhatsApp, Email, Ligar */}
      {(contact.phone || contact.whatsapp || contact.email) && (
        <div className="flex gap-2">
          {(contact.whatsapp || contact.phone) && (
            <a
              href={`https://wa.me/55${extractDigits(contact.whatsapp || contact.phone || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Email
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${extractDigits(contact.phone)}`}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              Ligar
            </a>
          )}
        </div>
      )}

      {/* Quick info fields */}
      <div className="space-y-3">
        {contact.company && (
          <InfoRow icon="building" label="Empresa" value={contact.company} />
        )}
        {/* Telefone - editable inline */}
        {(contact.phone || canModify) && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-purple-300/60 font-semibold mb-1">Telefone</p>
            {editingPhone ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(formatPhoneInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveField('phone', phoneValue);
                    if (e.key === 'Escape') { setPhoneValue(contact.phone || ''); setEditingPhone(false); }
                  }}
                  onBlur={() => saveField('phone', phoneValue)}
                  disabled={savingField}
                  className="flex-1 bg-[#1a0a2e] border border-purple-600/40 rounded px-2 py-1 text-sm text-neutral-200 outline-none focus:border-emerald-500/60"
                  placeholder="(11) 99999-9999"
                />
              </div>
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => canModify && setEditingPhone(true)}
                title={canModify ? 'Clique para editar' : ''}
              >
                <svg className="w-3.5 h-3.5 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <p className="text-sm text-neutral-200 break-all">{contact.phone || <span className="text-neutral-500 italic">Adicionar telefone</span>}</p>
                {canModify && (
                  <svg className="w-3 h-3 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                )}
              </div>
            )}
          </div>
        )}
        {contact.email && (
          <InfoRow icon="email" label="Email" value={contact.email} />
        )}
        {/* WhatsApp - editable inline */}
        {(contact.whatsapp || canModify) && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-purple-300/60 font-semibold mb-1">WhatsApp</p>
            {editingWhatsapp ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={whatsappValue}
                  onChange={(e) => setWhatsappValue(formatPhoneInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveField('whatsapp', whatsappValue);
                    if (e.key === 'Escape') { setWhatsappValue(contact.whatsapp || ''); setEditingWhatsapp(false); }
                  }}
                  onBlur={() => saveField('whatsapp', whatsappValue)}
                  disabled={savingField}
                  className="flex-1 bg-[#1a0a2e] border border-purple-600/40 rounded px-2 py-1 text-sm text-neutral-200 outline-none focus:border-emerald-500/60"
                  placeholder="(11) 99999-9999"
                />
              </div>
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => canModify && setEditingWhatsapp(true)}
                title={canModify ? 'Clique para editar' : ''}
              >
                <svg className="w-3.5 h-3.5 text-green-500/60" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <p className="text-sm text-neutral-200 break-all">{contact.whatsapp || <span className="text-neutral-500 italic">Adicionar WhatsApp</span>}</p>
                {canModify && (
                  <svg className="w-3 h-3 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                )}
              </div>
            )}
          </div>
        )}

        {/* Telefones Adicionais */}
        {onUpdatePhones && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-purple-300/60 font-semibold mb-2">Telefones</p>

            {/* Lista de telefones adicionais */}
            {telefones.length > 0 && (
              <div className="space-y-2 mb-2">
                {telefones.map((tel, idx) => (
                  <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg border ${tel.correto ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                    <button
                      onClick={() => handleToggleCorreto(idx)}
                      disabled={savingPhones}
                      className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        tel.correto
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-red-500 bg-red-500/20 text-red-400'
                      }`}
                      title={tel.correto ? 'Marcar como incorreto' : 'Marcar como correto'}
                    >
                      {tel.correto ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${tel.correto ? 'text-neutral-200' : 'text-red-400 line-through'}`}>{tel.phone}</p>
                      {tel.nome_contato && (
                        <p className="text-[11px] text-neutral-400 truncate">{tel.nome_contato}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`https://wa.me/55${extractDigits(tel.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-green-500/60 hover:text-green-400 transition-colors"
                        title="WhatsApp"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </a>
                      <a
                        href={`tel:${extractDigits(tel.phone)}`}
                        className="p-1 text-purple-400/60 hover:text-purple-300 transition-colors"
                        title="Ligar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      </a>
                      <button
                        onClick={() => handleRemovePhone(idx)}
                        disabled={savingPhones}
                        className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                        title="Remover"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Formulário inline para adicionar */}
            {showAddPhone ? (
              <div className="space-y-2 p-3 rounded-lg border border-purple-700/30 bg-[#2a1245]/50">
                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(formatPhoneInput(e.target.value))}
                  maxLength={15}
                  className="w-full px-3 py-1.5 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  placeholder="Nome do contato (opcional)"
                  value={newNomeContato}
                  onChange={(e) => setNewNomeContato(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCorreto}
                    onChange={(e) => setNewCorreto(e.target.checked)}
                    className="w-4 h-4 rounded border-purple-700/30 bg-[#2a1245] text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-neutral-300">Numero correto</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddPhone}
                    disabled={!newPhone.trim() || savingPhones}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                  >
                    {savingPhones ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => { setShowAddPhone(false); setNewPhone(''); setNewNomeContato(''); setNewCorreto(true); }}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-neutral-400 border border-purple-700/30 rounded-lg hover:bg-purple-800/20 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddPhone(true)}
                className="w-full px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 transition-colors flex items-center justify-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Adicionar telefone
              </button>
            )}
          </div>
        )}

        {contact.temperatura && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-purple-300/60 font-semibold mb-1">Temperatura</p>
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>
              {TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}
            </span>
          </div>
        )}
        {contact.classe && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-purple-300/60 font-semibold mb-1">Classe</p>
            <p className="text-sm text-neutral-200">{CLASSE_LABELS[contact.classe] || contact.classe}</p>
          </div>
        )}
        {contact.origem && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-purple-300/60 font-semibold mb-1">Origem</p>
            <p className="text-sm text-neutral-200">{ORIGEM_LABELS[contact.origem] || contact.origem}</p>
          </div>
        )}
      </div>

      {/* Owner */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-purple-300/60 font-semibold mb-2">Responsavel</p>
        {contact.assigned_to_user_id ? (
          <div>
            <div className="flex items-center gap-2.5">
              <div className="avatar-orbit shrink-0" style={{ width: 36, height: 36 }}>
                {ownerAvatarUrl ? (
                  <img src={ownerAvatarUrl} alt={ownerName} className="w-9 h-9 object-cover" />
                ) : (
                  <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                    {ownerName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <span className="text-sm text-neutral-200 font-medium">{ownerName || 'Carregando...'}</span>
            </div>
            {isAdmin && onUnassign && (
              <button
                onClick={onUnassign}
                className="mt-2 w-full px-3 py-1.5 text-[11px] font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                Remover responsavel
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-600 italic">Sem responsavel</p>
        )}
      </div>

      {/* Banners */}
      {isOtherOwner && (
        <div className="p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg">
          <p className="text-xs font-medium text-amber-300 mb-2">Atribuido a {ownerName || 'outro usuario'}</p>
          {pendingAccessRequest ? (
            <button disabled className="w-full px-3 py-1.5 text-xs font-medium text-emerald-400 border border-amber-600/50 rounded-lg opacity-60 cursor-not-allowed">
              Solicitacao Pendente
            </button>
          ) : (
            <button
              onClick={onRequestAccess}
              disabled={requestingAccess}
              className="w-full px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-500 disabled:opacity-40 transition-colors"
            >
              {requestingAccess ? 'Enviando...' : 'Solicitar Acesso'}
            </button>
          )}
        </div>
      )}

      {!contact.assigned_to_user_id && currentUser && (
        <button
          onClick={onClaim}
          disabled={claimingContact}
          className="w-full px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-40 transition-colors shadow-lg shadow-emerald-600/20"
        >
          {claimingContact ? 'Atribuindo...' : 'Apontar para mim'}
        </button>
      )}

      {/* Actions */}
      {canModify && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="flex-1 px-3 py-2 text-sm font-semibold text-emerald-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors"
            >
              Editar
            </button>
            {isAdmin && (
              <button
                onClick={onDelete}
                className="px-3 py-2 text-sm font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                Deletar
              </button>
            )}
          </div>
          {onToggleInexistente && (
            <button
              onClick={onToggleInexistente}
              className={`w-full px-3 py-2 text-sm font-medium border rounded-lg transition-colors flex items-center justify-center gap-2 ${
                contact.inexistente
                  ? 'text-neutral-400 border-neutral-600 hover:bg-neutral-800/30'
                  : 'text-red-400 border-red-500/30 hover:bg-red-500/10'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              {contact.inexistente ? 'Remover marca de Inexistente' : 'Marcar como Inexistente'}
            </button>
          )}
        </div>
      )}

      {/* Timestamps */}
      <div className="pt-3 border-t border-purple-800/30 space-y-1">
        <p className="text-[10px] text-neutral-600">Criado: {new Date(contact.created_at).toLocaleString('pt-BR')}</p>
        <p className="text-[10px] text-neutral-600">Atualizado: {new Date(contact.updated_at).toLocaleString('pt-BR')}</p>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const icons: Record<string, React.ReactNode> = {
    building: (
      <svg className="w-3.5 h-3.5 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    phone: (
      <svg className="w-3.5 h-3.5 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    email: (
      <svg className="w-3.5 h-3.5 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    whatsapp: (
      <svg className="w-3.5 h-3.5 text-green-500/60" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  };

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-purple-300/60 font-semibold mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {icons[icon]}
        <p className="text-sm text-neutral-200 break-all">{value}</p>
      </div>
    </div>
  );
}
