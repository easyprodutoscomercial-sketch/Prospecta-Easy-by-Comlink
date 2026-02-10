'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ESTADOS_BRASIL } from '@/lib/utils/labels';

export default function NewContactPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    cpf: '',
    cnpj: '',
    company: '',
    notes: '',
    tipo: [] as string[],
    referencia: '',
    classe: '',
    produtos_fornecidos: '',
    contato_nome: '',
    cargo: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    website: '',
    instagram: '',
    whatsapp: '',
  });

  const handleTipoChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      tipo: prev.tipo.includes(value)
        ? prev.tipo.filter((t) => t !== value)
        : [...prev.tipo, value],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDuplicate(null);

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.status === 409) {
        setDuplicate(data.duplicate);
        setError('Contato já existe no sistema');
      } else if (!res.ok) {
        setError(data.error || 'Erro ao criar contato');
      } else {
        router.push(`/contacts/${data.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar contato');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-neutral-700 mb-1";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/contacts" className="text-sm text-neutral-500 hover:text-neutral-900">
          &larr; Voltar para contatos
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Novo Contato</h1>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seção: Dados Básicos */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-medium text-neutral-900 mb-4 uppercase tracking-wide">Dados Básicos</h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Nome *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Telefone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={inputClass}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CPF</label>
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  className={inputClass}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className={labelClass}>CNPJ</label>
                <input
                  type="text"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  className={inputClass}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Empresa</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Seção: Tipo e Classificação */}
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
                  onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: LinkedIn, Feira, Indicação..."
                />
              </div>
              <div>
                <label className={labelClass}>Classe</label>
                <select
                  value={formData.classe}
                  onChange={(e) => setFormData({ ...formData, classe: e.target.value })}
                  className={inputClass}
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

        {/* Seção: Pessoa de Contato */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-medium text-neutral-900 mb-4 uppercase tracking-wide">Pessoa de Contato</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nome do Contato</label>
              <input
                type="text"
                value={formData.contato_nome}
                onChange={(e) => setFormData({ ...formData, contato_nome: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Cargo</label>
              <input
                type="text"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Seção: Endereço */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-medium text-neutral-900 mb-4 uppercase tracking-wide">Endereço</h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Endereço</label>
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                className={inputClass}
                placeholder="Rua, número, complemento"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Cidade</label>
                <input
                  type="text"
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Estado</label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  className={inputClass}
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
                  onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                  className={inputClass}
                  placeholder="00000-000"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Seção: Presença Digital */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-medium text-neutral-900 mb-4 uppercase tracking-wide">Presença Digital</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Website</label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className={inputClass}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className={labelClass}>Instagram</label>
              <input
                type="text"
                value={formData.instagram}
                onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                className={inputClass}
                placeholder="@usuario"
              />
            </div>
            <div>
              <label className={labelClass}>WhatsApp</label>
              <input
                type="text"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                className={inputClass}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
        </div>

        {/* Seção: Produtos e Observações */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-medium text-neutral-900 mb-4 uppercase tracking-wide">Produtos e Observações</h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Produtos Fornecidos</label>
              <input
                type="text"
                value={formData.produtos_fornecidos}
                onChange={(e) => setFormData({ ...formData, produtos_fornecidos: e.target.value })}
                className={inputClass}
                placeholder="Quais produtos ou serviços este contato fornece"
              />
            </div>
            <div>
              <label className={labelClass}>Observações</label>
              <textarea
                rows={4}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <Link
            href="/contacts"
            className="px-4 py-2 text-sm border border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Salvando...' : 'Criar Contato'}
          </button>
        </div>
      </form>
    </div>
  );
}
