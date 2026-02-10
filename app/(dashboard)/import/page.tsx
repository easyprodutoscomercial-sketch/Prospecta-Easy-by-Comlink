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

    // Parse CSV
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
    <div className="max-w-4xl mx-auto px-4 sm:px-0">
      <div className="mb-6">
        <Link href="/contacts" className="text-blue-600 hover:text-blue-700">
          ← Voltar para contatos
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Importar Contatos (CSV)</h1>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Formato do CSV</h2>
        <p className="text-gray-600 mb-2">O arquivo deve conter as seguintes colunas:</p>
        <code className="block bg-gray-100 p-3 rounded text-sm">
          name,phone,email,cpf,cnpj,company,notes
        </code>
        <p className="text-sm text-gray-500 mt-2">
          * Apenas <strong>name</strong> é obrigatório. Limite: 2.000 linhas.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Selecionar arquivo CSV</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Importando...' : 'Importar Contatos'}
        </button>
      </div>

      {result && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Resultado da Importação</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold">{result.total_rows}</p>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <p className="text-sm text-gray-600">Criados</p>
              <p className="text-2xl font-bold text-green-600">{result.created_count}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded">
              <p className="text-sm text-gray-600">Duplicados</p>
              <p className="text-2xl font-bold text-yellow-600">{result.duplicate_count}</p>
            </div>
            <div className="bg-red-50 p-4 rounded">
              <p className="text-sm text-gray-600">Inválidos</p>
              <p className="text-2xl font-bold text-red-600">{result.invalid_count}</p>
            </div>
          </div>

          {result.items && result.items.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Detalhes</h3>
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Linha</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nome</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {result.items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">{item.row_number}</td>
                        <td className="px-4 py-2 text-sm">{item.data.name}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 text-xs rounded ${
                            item.status === 'created' ? 'bg-green-100 text-green-800' :
                            item.status === 'duplicate' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {item.contact_id && (
                            <Link href={`/contacts/${item.contact_id}`} className="text-blue-600">
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
