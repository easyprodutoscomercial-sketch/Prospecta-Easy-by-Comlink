'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

const TEMPLATE_COLUMNS = [
  'name', 'phone', 'email', 'cpf', 'cnpj', 'company', 'notes',
  'tipo', 'referencia', 'classe', 'produtos_fornecidos',
  'contato_nome', 'cargo', 'endereco', 'cidade', 'estado', 'cep',
  'website', 'instagram', 'whatsapp',
];

const TEMPLATE_ROWS = [
  {
    name: 'João Silva', phone: '(11) 99999-0001', email: 'joao@exemplo.com',
    cpf: '123.456.789-00', cnpj: '', company: 'Empresa ABC',
    notes: 'Cliente em prospecção', tipo: 'COMPRADOR', referencia: 'LinkedIn',
    classe: 'A', produtos_fornecidos: '', contato_nome: '', cargo: 'Diretor',
    endereco: '', cidade: 'São Paulo', estado: 'SP', cep: '',
    website: '', instagram: '', whatsapp: '(11) 99999-0001',
  },
  {
    name: 'Maria Souza', phone: '(21) 98888-0002', email: 'maria@exemplo.com',
    cpf: '', cnpj: '', company: 'Empresa XYZ',
    notes: 'Indicação do João', tipo: 'FORNECEDOR,COMPRADOR', referencia: 'Indicação',
    classe: 'B', produtos_fornecidos: 'Peças industriais', contato_nome: 'Maria Souza',
    cargo: 'Gerente', endereco: 'Rua das Flores 123', cidade: 'Rio de Janeiro',
    estado: 'RJ', cep: '20000-000', website: 'https://empresaxyz.com',
    instagram: '@empresaxyz', whatsapp: '(21) 98888-0002',
  },
  {
    name: 'Pedro Santos', phone: '(31) 97777-0003', email: 'pedro@exemplo.com',
    cpf: '', cnpj: '12.345.678/0001-90', company: 'Tech Ltda',
    notes: 'Reunião marcada para segunda', tipo: 'FORNECEDOR', referencia: 'Feira',
    classe: 'A', produtos_fornecidos: 'Componentes eletrônicos', contato_nome: 'Pedro Santos',
    cargo: 'CEO', endereco: '', cidade: 'Belo Horizonte', estado: 'MG', cep: '',
    website: '', instagram: '', whatsapp: '(31) 97777-0003',
  },
];

function downloadTemplate() {
  const ws = XLSX.utils.json_to_sheet(TEMPLATE_ROWS, { header: TEMPLATE_COLUMNS });

  // Set column widths
  ws['!cols'] = TEMPLATE_COLUMNS.map((col) => ({
    wch: col === 'name' || col === 'company' || col === 'email' ? 25 : col === 'notes' || col === 'endereco' ? 30 : 18,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
  XLSX.writeFile(wb, 'template-contatos.xlsx');
}

function parseExcelFile(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const rows = await parseExcelFile(file);

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      alert('Erro ao importar. Verifique se o arquivo é um Excel (.xlsx) válido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <Link href="/contacts" className="text-sm text-purple-300/50 hover:text-emerald-400">
          &larr; Voltar para contatos
        </Link>
        <h1 className="text-2xl font-semibold text-emerald-400 mt-2">Importar Contatos</h1>
        <p className="text-sm text-purple-300/60 mt-1">Importe contatos a partir de um arquivo Excel (.xlsx).</p>
      </div>

      {/* Template download */}
      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-neutral-100">Formato do arquivo</h2>
            <p className="text-sm text-purple-300/60 mt-1">
              A planilha deve conter as colunas abaixo. Apenas <strong>name</strong> é obrigatório. Limite: 2.000 linhas.
            </p>
            <code className="inline-block bg-[#2a1245] text-purple-200 px-3 py-1.5 rounded text-xs mt-3 leading-relaxed">
              name, phone, email, cpf, cnpj, company, notes, tipo, referencia, classe, produtos_fornecidos, contato_nome, cargo, endereco, cidade, estado, cep, website, instagram, whatsapp
            </code>
          </div>
          <button
            onClick={downloadTemplate}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Baixar modelo Excel
          </button>
        </div>
      </div>

      {/* Upload area */}
      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5 mb-6">
        <label className="block text-sm font-medium text-neutral-100 mb-3">Selecionar arquivo Excel (.xlsx)</label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="block w-full text-sm text-purple-300/60
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-medium
            file:bg-emerald-600 file:text-white
            hover:file:bg-emerald-500
            file:cursor-pointer file:transition-colors"
        />

        {file && (
          <p className="text-xs text-purple-300/60 mt-2">
            Arquivo selecionado: {file.name}
          </p>
        )}

        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="mt-4 w-full px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Importando...' : 'Importar Contatos'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
          <h2 className="text-sm font-medium text-emerald-400 mb-4">Resultado da Importação</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#2a1245] p-3 rounded-lg">
              <p className="text-xs text-purple-300/60">Total</p>
              <p className="text-xl font-semibold text-neutral-100">{result.total_rows}</p>
            </div>
            <div className="bg-emerald-500/15 p-3 rounded-lg">
              <p className="text-xs text-purple-300/60">Criados</p>
              <p className="text-xl font-semibold text-emerald-400">{result.created_count}</p>
            </div>
            <div className="bg-amber-500/15 p-3 rounded-lg">
              <p className="text-xs text-purple-300/60">Duplicados</p>
              <p className="text-xl font-semibold text-amber-400">{result.duplicate_count}</p>
            </div>
            <div className="bg-red-500/15 p-3 rounded-lg">
              <p className="text-xs text-purple-300/60">Inválidos</p>
              <p className="text-xl font-semibold text-red-400">{result.invalid_count}</p>
            </div>
          </div>

          {result.items && result.items.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-neutral-100 mb-2">Detalhes</h3>
              <div className="max-h-80 overflow-y-auto border border-purple-800/30 rounded-lg">
                <table className="min-w-full divide-y divide-purple-800/30">
                  <thead className="bg-[#2a1245] sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-purple-300/60">Linha</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-purple-300/60">Nome</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-purple-300/60">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-purple-300/60">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-800/20">
                    {result.items.map((item: any, idx: number) => (
                      <tr key={idx} className="bg-[#1e0f35]">
                        <td className="px-4 py-2 text-sm text-purple-300/60">{item.row_number}</td>
                        <td className="px-4 py-2 text-sm text-neutral-100">{item.data.name}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            item.status === 'created' ? 'bg-emerald-500/15 text-emerald-400' :
                            item.status === 'duplicate' ? 'bg-amber-500/15 text-amber-400' :
                            'bg-red-500/15 text-red-400'
                          }`}>
                            {item.status === 'created' ? 'Criado' :
                             item.status === 'duplicate' ? 'Duplicado' : 'Inválido'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {item.contact_id && (
                            <Link href={`/contacts/${item.contact_id}`} className="text-emerald-400 hover:underline font-medium text-xs">
                              Ver contato
                            </Link>
                          )}
                          {item.error_message && (
                            <span className={`text-xs ${item.status === 'duplicate' ? 'text-amber-400' : 'text-red-400'}`}>{item.error_message}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
