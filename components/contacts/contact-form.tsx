'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Contact } from '@/lib/types';
import { ESTADOS_BRASIL } from '@/lib/utils/labels';

interface ContactFormData {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  cnpj: string;
  company: string;
  notes: string;
  tipo: string[];
  referencia: string;
  classe: string;
  produtos_fornecidos: string;
  contato_nome: string;
  cargo: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  website: string;
  instagram: string;
  whatsapp: string;
}

interface ContactFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<Contact>;
  onSubmit: (data: ContactFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
  duplicate?: { id: string; name: string } | null;
}

function toFormData(contact?: Partial<Contact>): ContactFormData {
  return {
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    cpf: contact?.cpf || '',
    cnpj: contact?.cnpj || '',
    company: contact?.company || '',
    notes: contact?.notes || '',
    tipo: contact?.tipo || [],
    referencia: contact?.referencia || '',
    classe: contact?.classe || '',
    produtos_fornecidos: contact?.produtos_fornecidos || '',
    contato_nome: contact?.contato_nome || '',
    cargo: contact?.cargo || '',
    endereco: contact?.endereco || '',
    cidade: contact?.cidade || '',
    estado: contact?.estado || '',
    cep: contact?.cep || '',
    website: contact?.website || '',
    instagram: contact?.instagram || '',
    whatsapp: contact?.whatsapp || '',
  };
}

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
}: ContactFormProps) {
  const [formData, setFormData] = useState<ContactFormData>(toFormData(initialData));
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleTipoChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      tipo: prev.tipo.includes(value)
        ? prev.tipo.filter((t) => t !== value)
        : [...prev.tipo, value],
    }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = 'Nome é obrigatório';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = 'Email inválido';
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  const update = (field: keyof ContactFormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const inputClass = (field?: string) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent ${
      field && validationErrors[field] ? 'border-red-300' : 'border-neutral-200'
    }`;
  const labelClass = 'block text-sm font-medium text-neutral-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
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

      {/* Dados Básicos */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-medium text-neutral-900 mb-4 uppercase tracking-wide">Dados Básicos</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Nome *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => update('name', e.target.value)}
              className={inputClass('name')}
            />
            {validationErrors.name && <p className="text-xs text-red-500 mt-1">{validationErrors.name}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Telefone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => update('phone', formatPhone(e.target.value))}
                className={inputClass()}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="text"
                value={formData.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputClass('email')}
              />
              {validationErrors.email && <p className="text-xs text-red-500 mt-1">{validationErrors.email}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>CPF</label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => update('cpf', formatCPF(e.target.value))}
                className={inputClass()}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className={labelClass}>CNPJ</label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => update('cnpj', formatCNPJ(e.target.value))}
                className={inputClass()}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Empresa</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => update('company', e.target.value)}
              className={inputClass()}
            />
          </div>
        </div>
      </div>

      {/* Tipo e Classificação */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-medium text-neutral-900 mb-4 uppercase tracking-wide">Tipo e Classificação</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Tipo</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.tipo.includes('FORNECEDOR')}
                  onChange={() => handleTipoChange('FORNECEDOR')}
                  className="rounded border-neutral-300"
                />
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Fornecedor</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.tipo.includes('COMPRADOR')}
                  onChange={() => handleTipoChange('COMPRADOR')}
                  className="rounded border-neutral-300"
                />
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-cyan-100 text-cyan-700">Comprador</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Referência</label>
              <input
                type="text"
                value={formData.referencia}
                onChange={(e) => update('referencia', e.target.value)}
                className={inputClass()}
                placeholder="Ex: LinkedIn, Feira, Indicação..."
              />
            </div>
            <div>
              <label className={labelClass}>Classe</label>
              <select
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

      {/* Pessoa de Contato */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-medium text-neutral-900 mb-4 uppercase tracking-wide">Pessoa de Contato</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome do Contato</label>
            <input
              type="text"
              value={formData.contato_nome}
              onChange={(e) => update('contato_nome', e.target.value)}
              className={inputClass()}
            />
          </div>
          <div>
            <label className={labelClass}>Cargo</label>
            <input
              type="text"
              value={formData.cargo}
              onChange={(e) => update('cargo', e.target.value)}
              className={inputClass()}
            />
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-medium text-neutral-900 mb-4 uppercase tracking-wide">Endereço</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Endereço</label>
            <input
              type="text"
              value={formData.endereco}
              onChange={(e) => update('endereco', e.target.value)}
              className={inputClass()}
              placeholder="Rua, número, complemento"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Cidade</label>
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) => update('cidade', e.target.value)}
                className={inputClass()}
              />
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <select
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
              <label className={labelClass}>CEP</label>
              <input
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
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-medium text-neutral-900 mb-4 uppercase tracking-wide">Presença Digital</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Website</label>
            <input
              type="text"
              value={formData.website}
              onChange={(e) => update('website', e.target.value)}
              className={inputClass()}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className={labelClass}>Instagram</label>
            <input
              type="text"
              value={formData.instagram}
              onChange={(e) => update('instagram', e.target.value)}
              className={inputClass()}
              placeholder="@usuario"
            />
          </div>
          <div>
            <label className={labelClass}>WhatsApp</label>
            <input
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
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-medium text-neutral-900 mb-4 uppercase tracking-wide">Produtos e Observações</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Produtos Fornecidos</label>
            <input
              type="text"
              value={formData.produtos_fornecidos}
              onChange={(e) => update('produtos_fornecidos', e.target.value)}
              className={inputClass()}
              placeholder="Quais produtos ou serviços este contato fornece"
            />
          </div>
          <div>
            <label className={labelClass}>Observações</label>
            <textarea
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
          className="px-4 py-2 text-sm border border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Salvando...' : mode === 'create' ? 'Criar Contato' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
}
