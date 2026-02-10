'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSeed = async () => {
    if (!confirm('Inserir 10 contatos fictícios no banco?')) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResult(`${data.created?.length || 0} contatos criados com sucesso.`);
      } else {
        setResult(`Erro: ${data.error}`);
      }
    } catch {
      setResult('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('ATENÇÃO: Isso vai deletar TODOS os contatos. Tem certeza?')) return;
    if (!confirm('Última chance — deletar todos os contatos?')) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/contacts?limit=1000');
      const data = await res.json();
      const contacts = data.contacts || [];

      let deleted = 0;
      for (const contact of contacts) {
        const delRes = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
        if (delRes.ok) deleted++;
      }
      setResult(`${deleted} contatos deletados.`);
    } catch {
      setResult('Erro ao deletar contatos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Administração</h1>
      <p className="text-sm text-neutral-500 mb-8">Ferramentas de gerenciamento do sistema.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seed */}
        <div className="border border-neutral-200 rounded-lg p-5">
          <h2 className="text-sm font-medium text-neutral-900 mb-1">Dados de Teste</h2>
          <p className="text-xs text-neutral-500 mb-4">
            Insere 10 contatos fictícios com diferentes status para testar o sistema.
          </p>
          <button
            onClick={handleSeed}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Processando...' : 'Inserir Dados Fictícios'}
          </button>
        </div>

        {/* Clear all */}
        <div className="border border-red-200 rounded-lg p-5">
          <h2 className="text-sm font-medium text-red-900 mb-1">Limpar Base</h2>
          <p className="text-xs text-neutral-500 mb-4">
            Remove todos os contatos e interações do sistema. Ação irreversível.
          </p>
          <button
            onClick={handleClearAll}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Processando...' : 'Deletar Todos os Contatos'}
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-6 border border-neutral-200 rounded-lg p-4">
          <p className="text-sm text-neutral-700">{result}</p>
        </div>
      )}
    </div>
  );
}
