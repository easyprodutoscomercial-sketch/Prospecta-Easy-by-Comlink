'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Contact, PipelineWithStages } from '@/lib/types';
import { ESTADOS_BRASIL, TEMPERATURA_LABELS, ORIGEM_LABELS, PROXIMA_ACAO_LABELS } from '@/lib/utils/labels';

interface ContactFormData {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  cnpj: string;
  sem_documento: boolean;
  company: string;
  notes: string;
  tipo: string[];
  referencia: string;
  classe: string;
  produtos_fornecidos: string;
  temperatura: string;
  segmento: string;
  origem: string;
  proxima_acao_tipo: string;
  proxima_acao_data: string;
  contato_nome: string;
  cargo: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  website: string;
  instagram: string;
  whatsapp: string;
  valor_estimado: string;
  pipeline_id: string;
  event_id: string | null;
}

interface ContactFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<Contact>;
  onSubmit: (data: ContactFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
  duplicate?: { id: string; name: string } | null;
  pipelines?: PipelineWithStages[];
  defaultPipelineId?: string;
}

function toFormData(contact?: Partial<Contact>, defaultPipelineId?: string): ContactFormData {
  return {
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    cpf: contact?.cpf || '',
    cnpj: contact?.cnpj || '',
    sem_documento: !contact?.cpf && !contact?.cnpj && !!contact?.id,
    company: contact?.company || '',
    notes: contact?.notes || '',
    tipo: contact?.tipo || [],
    referencia: contact?.referencia || '',
    classe: contact?.classe || '',
    produtos_fornecidos: contact?.produtos_fornecidos || '',
    temperatura: contact?.temperatura || '',
    segmento: contact?.segmento || '',
    origem: contact?.origem || '',
    proxima_acao_tipo: contact?.proxima_acao_tipo || '',
    proxima_acao_data: contact?.proxima_acao_data ? new Date(contact.proxima_acao_data).toISOString().slice(0, 16) : '',
    contato_nome: contact?.contato_nome || '',
    cargo: contact?.cargo || '',
    endereco: contact?.endereco || '',
    cidade: contact?.cidade || '',
    estado: contact?.estado || '',
    cep: contact?.cep || '',
    website: contact?.website || '',
    instagram: contact?.instagram || '',
    whatsapp: contact?.whatsapp || '',
    valor_estimado: contact?.valor_estimado != null ? String(contact.valor_estimado) : '',
    pipeline_id: contact?.pipeline_id || defaultPipelineId || '',
    event_id: contact?.event_id || null,
  };
}

type ActiveEvent = { id: string; name: string; location?: string | null };

// Auto-format helpers
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export default function ContactForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  error,
  duplicate,
  pipelines,
  defaultPipelineId,
}: ContactFormProps) {
  const [formData, setFormData] = useState<ContactFormData>(toFormData(initialData, defaultPipelineId));
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);

  useEffect(() => {
    if (mode !== 'create') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/events?status=ATIVO');
        if (!res.ok) return;
        const data = await res.json();
        const list: ActiveEvent[] = Array.isArray(data) ? data : (data.events || []);
        if (!cancelled) setActiveEvents(list);
      } catch {
        /* silencioso — feature opcional */
      }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  const linkedEvent = activeEvents.find((e) => e.id === formData.event_id) || null;
  const toggleEventLink = (eventId: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      event_id: checked ? eventId : null,
      origem: checked ? 'FEIRA' : prev.origem,
    }));
  };

  const handleTipoSelect = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      tipo:
        value === 'AMBOS'
          ? ['FORNECEDOR', 'COMPRADOR']
          : value
            ? [value]
            : [],
    }));
  };

  const tipoSelectValue =
    formData.tipo.includes('FORNECEDOR') && formData.tipo.includes('COMPRADOR')
      ? 'AMBOS'
      : formData.tipo[0] || '';

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = 'Nome é obrigatório';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = 'Email inválido';
    }
    const cpfDigits = formData.cpf?.replace(/\D/g, '') || '';
    const cnpjDigits = formData.cnpj?.replace(/\D/g, '') || '';
    if (!formData.sem_documento && cpfDigits.length !== 11 && cnpjDigits.length !== 14) {
      errs.cpf = 'Preencha pelo menos CPF ou CNPJ, ou marque "Não possui"';
    }
    if (Object.keys(errs).length > 0) {
      console.warn('[FORM] Erros de validacao:', errs);
      console.warn('[FORM] CPF digits:', cpfDigits.length, '| CNPJ digits:', cnpjDigits.length);
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[FORM] Tentando enviar formulario...', JSON.stringify(formData, null, 2));
    if (!validate()) {
      console.warn('[FORM] Validacao falhou:', validationErrors);
      return;
    }
    console.log('[FORM] Validacao OK, enviando...');
    await onSubmit(formData);
  };

  const update = (field: keyof ContactFormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const inputClass = (field?: string) =>
    `w-full px-3 py-2 text-sm border rounded-lg bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors ${
      field && validationErrors[field] ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-purple-700/30'
    }`;
  const labelClass = 'block text-sm font-medium text-purple-200/80 mb-1';
  const errorClass = 'flex items-center gap-1 text-xs text-red-400 mt-1';
  const errorIcon = <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm animate-fade-in">
          {error}
          {duplicate && (
            <div className="mt-2">
              <Link href={`/contacts/${duplicate.id}`} className="font-medium underline">
                Ver contato existente: {duplicate.name}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Pipeline selector (create mode with multiple pipelines) */}
      {mode === 'create' && pipelines && pipelines.length > 1 && (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
          <h2 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Pipeline</h2>
          <p className="text-xs text-purple-300/60 mb-3">Em qual pipeline este contato sera adicionado?</p>
          <div className="flex gap-2 flex-wrap">
            {pipelines.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => update('pipeline_id', p.id)}
                className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  formData.pipeline_id === p.id
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                    : 'bg-[#2a1245] border-purple-800/30 text-purple-300/60 hover:border-purple-600/50'
                }`}
              >
                {p.name}
                {p.is_default && (
                  <span className="ml-1.5 text-[9px] font-bold uppercase opacity-60">(Padrao)</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feira ativa (só no modo create, se houver evento ATIVO) */}
      {mode === 'create' && activeEvents.length > 0 && (
        <div className={`rounded-xl border p-5 transition-colors ${
          formData.event_id
            ? 'bg-emerald-500/10 border-emerald-500/40'
            : 'bg-[#1e0f35] border-purple-800/30'
        }`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!formData.event_id}
              onChange={(e) => {
                const targetId = formData.event_id || activeEvents[0]?.id;
                if (targetId) toggleEventLink(targetId, e.target.checked);
              }}
              className="mt-1 rounded border-purple-700/30 bg-[#2a1245] text-emerald-500 focus:ring-emerald-500"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">
                📍 Estou na feira{linkedEvent ? ` ${linkedEvent.name}` : activeEvents.length === 1 ? ` ${activeEvents[0].name}` : ''} — vincular este contato ao evento
              </div>
              <div className="text-xs text-purple-200/60 mt-1">
                Marca origem como <span className="text-emerald-400 font-medium">Feira</span> e aparece na aba Contatos do evento.
              </div>
              {activeEvents.length > 1 && formData.event_id && (
                <select
                  value={formData.event_id || ''}
                  onChange={(e) => toggleEventLink(e.target.value, true)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 w-full px-3 py-2 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {activeEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}{ev.location ? ` — ${ev.location}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </label>
        </div>
      )}

      {/* Dados Básicos */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
        <h2 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Dados Básicos</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="contact-name" className={labelClass}>Nome *</label>
            <input
              id="contact-name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => update('name', e.target.value)}
              className={inputClass('name')}
              aria-invalid={!!validationErrors.name}
              aria-describedby={validationErrors.name ? 'name-error' : undefined}
            />
            {validationErrors.name && <p id="name-error" className={errorClass}>{errorIcon}{validationErrors.name}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contact-phone" className={labelClass}>Telefone</label>
              <input
                id="contact-phone"
                type="text"
                value={formData.phone}
                onChange={(e) => update('phone', formatPhone(e.target.value))}
                className={inputClass()}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className={labelClass}>Email</label>
              <input
                id="contact-email"
                type="text"
                value={formData.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputClass('email')}
                aria-invalid={!!validationErrors.email}
                aria-describedby={validationErrors.email ? 'email-error' : undefined}
              />
              {validationErrors.email && <p id="email-error" className={errorClass}>{errorIcon}{validationErrors.email}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contact-cpf" className={labelClass}>CPF {!formData.sem_documento && <>{' *'} <span className="text-purple-300/40 text-[10px] font-normal">(preencha pelo menos um)</span></>}</label>
              <input
                id="contact-cpf"
                type="text"
                value={formData.cpf}
                onChange={(e) => update('cpf', formatCPF(e.target.value))}
                className={inputClass('cpf')}
                placeholder="000.000.000-00"
                disabled={formData.sem_documento}
                aria-invalid={!!validationErrors.cpf}
                aria-describedby={validationErrors.cpf ? 'cpf-error' : undefined}
              />
              {validationErrors.cpf && <p id="cpf-error" className={errorClass}>{errorIcon}{validationErrors.cpf}</p>}
            </div>
            <div>
              <label htmlFor="contact-cnpj" className={labelClass}>CNPJ {!formData.sem_documento && <>{' *'} <span className="text-purple-300/40 text-[10px] font-normal">(preencha pelo menos um)</span></>}</label>
              <input
                id="contact-cnpj"
                type="text"
                value={formData.cnpj}
                onChange={(e) => update('cnpj', formatCNPJ(e.target.value))}
                className={inputClass('cpf')}
                placeholder="00.000.000/0000-00"
                disabled={formData.sem_documento}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-purple-200/70 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={formData.sem_documento}
              onChange={(e) => {
                const checked = e.target.checked;
                setFormData((prev) => ({
                  ...prev,
                  sem_documento: checked,
                  ...(checked ? { cpf: '', cnpj: '' } : {}),
                }));
                if (checked && validationErrors.cpf) {
                  setValidationErrors((prev) => { const next = { ...prev }; delete next.cpf; return next; });
                }
              }}
              className="rounded border-purple-700/30 bg-[#2a1245] text-emerald-500 focus:ring-emerald-500"
            />
            Não possui CPF/CNPJ
          </label>
          <div>
            <label htmlFor="contact-company" className={labelClass}>Empresa</label>
            <input
              id="contact-company"
              type="text"
              value={formData.company}
              onChange={(e) => update('company', e.target.value)}
              className={inputClass()}
            />
          </div>
        </div>
      </div>

      {/* Tipo e Classificação */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
        <h2 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Tipo e Classificação</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Tipo</label>
            <select
              value={tipoSelectValue}
              onChange={(e) => handleTipoSelect(e.target.value)}
              className={inputClass()}
            >
              <option value="">Selecione...</option>
              <option value="FORNECEDOR">Fornecedor</option>
              <option value="COMPRADOR">Comprador</option>
              <option value="AMBOS">Ambos (Fornecedor + Comprador)</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contact-referencia" className={labelClass}>Referência</label>
              <input
                id="contact-referencia"
                type="text"
                value={formData.referencia}
                onChange={(e) => update('referencia', e.target.value)}
                className={inputClass()}
                placeholder="Ex: LinkedIn, Feira, Indicação..."
              />
            </div>
            <div>
              <label htmlFor="contact-classe" className={labelClass}>Classe</label>
              <select
                id="contact-classe"
                value={formData.classe}
                onChange={(e) => update('classe', e.target.value)}
                className={inputClass()}
              >
                <option value="">Sem classificação</option>
                <option value="A">Classe A</option>
                <option value="B">Classe B</option>
                <option value="C">Classe C</option>
                <option value="D">Classe D</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Qualificação */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
        <h2 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Qualificação</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="contact-temperatura" className={labelClass}>Temperatura</label>
              <select
                id="contact-temperatura"
                value={formData.temperatura}
                onChange={(e) => update('temperatura', e.target.value)}
                className={inputClass()}
              >
                <option value="">Sem temperatura</option>
                {Object.entries(TEMPERATURA_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="contact-segmento" className={labelClass}>Segmento</label>
              <input
                id="contact-segmento"
                type="text"
                value={formData.segmento || ''}
                onChange={(e) => update('segmento', e.target.value)}
                placeholder="Ex: Transportadora, Agricola, Varejo..."
                className={inputClass()}
              />
            </div>
            <div>
              <label htmlFor="contact-origem" className={labelClass}>Origem</label>
              <select
                id="contact-origem"
                value={formData.origem}
                onChange={(e) => update('origem', e.target.value)}
                className={inputClass()}
              >
                <option value="">Sem origem</option>
                {Object.entries(ORIGEM_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contact-proxima-acao" className={labelClass}>Próxima Ação</label>
              <select
                id="contact-proxima-acao"
                value={formData.proxima_acao_tipo}
                onChange={(e) => update('proxima_acao_tipo', e.target.value)}
                className={inputClass()}
              >
                <option value="">Sem próxima ação</option>
                {Object.entries(PROXIMA_ACAO_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            {formData.proxima_acao_tipo && (
              <div>
                <label htmlFor="contact-proxima-acao-data" className={labelClass}>Data da Próxima Ação</label>
                <input
                  id="contact-proxima-acao-data"
                  type="datetime-local"
                  value={formData.proxima_acao_data}
                  onChange={(e) => update('proxima_acao_data', e.target.value)}
                  className={inputClass()}
                />
              </div>
            )}
          </div>
          <div>
            <label htmlFor="contact-valor" className={labelClass}>Valor Estimado (R$)</label>
            <input
              id="contact-valor"
              type="number"
              step="0.01"
              min="0"
              value={formData.valor_estimado}
              onChange={(e) => update('valor_estimado', e.target.value)}
              className={inputClass()}
              placeholder="0,00"
            />
          </div>
        </div>
      </div>

      {/* Pessoa de Contato */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
        <h2 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Pessoa de Contato</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="contact-contato-nome" className={labelClass}>Nome do Contato</label>
            <input
              id="contact-contato-nome"
              type="text"
              value={formData.contato_nome}
              onChange={(e) => update('contato_nome', e.target.value)}
              className={inputClass()}
            />
          </div>
          <div>
            <label htmlFor="contact-cargo" className={labelClass}>Cargo</label>
            <input
              id="contact-cargo"
              type="text"
              value={formData.cargo}
              onChange={(e) => update('cargo', e.target.value)}
              className={inputClass()}
            />
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
        <h2 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Endereço</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="contact-endereco" className={labelClass}>Endereço</label>
            <input
              id="contact-endereco"
              type="text"
              value={formData.endereco}
              onChange={(e) => update('endereco', e.target.value)}
              className={inputClass()}
              placeholder="Rua, número, complemento"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="contact-cidade" className={labelClass}>Cidade</label>
              <input
                id="contact-cidade"
                type="text"
                value={formData.cidade}
                onChange={(e) => update('cidade', e.target.value)}
                className={inputClass()}
              />
            </div>
            <div>
              <label htmlFor="contact-estado" className={labelClass}>Estado</label>
              <select
                id="contact-estado"
                value={formData.estado}
                onChange={(e) => update('estado', e.target.value)}
                className={inputClass()}
              >
                <option value="">Selecione</option>
                {ESTADOS_BRASIL.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="contact-cep" className={labelClass}>CEP</label>
              <input
                id="contact-cep"
                type="text"
                value={formData.cep}
                onChange={(e) => update('cep', formatCEP(e.target.value))}
                className={inputClass()}
                placeholder="00000-000"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Presença Digital */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
        <h2 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Presença Digital</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="contact-website" className={labelClass}>Website</label>
            <input
              id="contact-website"
              type="text"
              value={formData.website}
              onChange={(e) => update('website', e.target.value)}
              className={inputClass()}
              placeholder="https://..."
            />
          </div>
          <div>
            <label htmlFor="contact-instagram" className={labelClass}>Instagram</label>
            <input
              id="contact-instagram"
              type="text"
              value={formData.instagram}
              onChange={(e) => update('instagram', e.target.value)}
              className={inputClass()}
              placeholder="@usuario"
            />
          </div>
          <div>
            <label htmlFor="contact-whatsapp" className={labelClass}>WhatsApp</label>
            <input
              id="contact-whatsapp"
              type="text"
              value={formData.whatsapp}
              onChange={(e) => update('whatsapp', formatPhone(e.target.value))}
              className={inputClass()}
              placeholder="(11) 99999-9999"
            />
          </div>
        </div>
      </div>

      {/* Produtos e Observações */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
        <h2 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Produtos e Observações</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="contact-produtos" className={labelClass}>Produtos Fornecidos</label>
            <input
              id="contact-produtos"
              type="text"
              value={formData.produtos_fornecidos}
              onChange={(e) => update('produtos_fornecidos', e.target.value)}
              className={inputClass()}
              placeholder="Quais produtos ou serviços este contato fornece"
            />
          </div>
          <div>
            <label htmlFor="contact-notes" className={labelClass}>Observações</label>
            <textarea
              id="contact-notes"
              rows={4}
              value={formData.notes}
              onChange={(e) => update('notes', e.target.value)}
              className={inputClass()}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-purple-700/30 rounded-lg text-purple-200/70 hover:bg-purple-500/10 hover:text-white btn-press transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-50 btn-press shadow-lg shadow-emerald-600/20 transition-colors"
        >
          {loading ? 'Salvando...' : mode === 'create' ? 'Criar Contato' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
}
