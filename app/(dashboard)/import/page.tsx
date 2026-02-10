'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import Link from 'next/link';

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

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: results.data }),
          });

          const data = await res.json();
          setResult(data);
        } catch (error) {
          alert('Erro ao importar');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <div>
      <div className="mb-8">
        <Link href="/contacts" className="text-sm text-neutral-500 hover:text-neutral-900">
          &larr; Voltar para contatos
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900 mt-2">Importar Contatos</h1>
        <p className="text-sm text-neutral-500 mt-1">Importe contatos a partir de um arquivo CSV.</p>
      </div>

      {/* Template download */}
      <div className="border border-neutral-200 rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-neutral-900">Formato do arquivo</h2>
            <p className="text-sm text-neutral-500 mt-1">
              O CSV deve conter as colunas abaixo. Apenas <strong>name</strong> é obrigatório. Limite: 2.000 linhas.
            </p>
            <code className="inline-block bg-neutral-100 text-neutral-700 px-3 py-1.5 rounded text-xs mt-3">
              name, phone, email, cpf, cnpj, company, notes
            </code>
          </div>
          <a
            href="/template-contatos.csv"
            download
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Baixar modelo
          </a>
        </div>
      </div>

      {/* Upload area */}
      <div className="border border-neutral-200 rounded-lg p-5 mb-6">
        <label className="block text-sm font-medium text-neutral-900 mb-3">Selecionar arquivo CSV</label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-neutral-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-medium
            file:bg-neutral-900 file:text-white
            hover:file:bg-neutral-700
            file:cursor-pointer file:transition-colors"
        />

        {file && (
          <p className="text-xs text-neutral-500 mt-2">
            Arquivo selecionado: {file.name}
          </p>
        )}

        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="mt-4 w-full px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Importando...' : 'Importar Contatos'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="border border-neutral-200 rounded-lg p-5">
          <h2 className="text-sm font-medium text-neutral-900 mb-4">Resultado da Importação</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-neutral-50 p-3 rounded-lg">
              <p className="text-xs text-neutral-500">Total</p>
              <p className="text-xl font-semibold text-neutral-900">{result.total_rows}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-xs text-neutral-500">Criados</p>
              <p className="text-xl font-semibold text-green-700">{result.created_count}</p>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg">
              <p className="text-xs text-neutral-500">Duplicados</p>
              <p className="text-xl font-semibold text-amber-700">{result.duplicate_count}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <p className="text-xs text-neutral-500">Inválidos</p>
              <p className="text-xl font-semibold text-red-700">{result.invalid_count}</p>
            </div>
          </div>

          {result.items && result.items.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-neutral-900 mb-2">Detalhes</h3>
              <div className="max-h-80 overflow-y-auto border border-neutral-200 rounded-lg">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500">Linha</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500">Nome</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {result.items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm text-neutral-600">{item.row_number}</td>
                        <td className="px-4 py-2 text-sm text-neutral-900">{item.data.name}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            item.status === 'created' ? 'bg-green-100 text-green-700' :
                            item.status === 'duplicate' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {item.status === 'created' ? 'Criado' :
                             item.status === 'duplicate' ? 'Duplicado' : 'Inválido'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {item.contact_id && (
                            <Link href={`/contacts/${item.contact_id}`} className="text-neutral-900 hover:underline font-medium text-xs">
                              Ver contato
                            </Link>
                          )}
                          {item.error_message && (
                            <span className="text-red-600 text-xs">{item.error_message}</span>
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
