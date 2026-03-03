'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface AuditEntry {
  id: string;
  user_name: string;
  entity: string;
  entity_id: string | null;
  action: string;
  old_values: any;
  new_values: any;
  created_at: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?page=${page}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-purple-300/40 hover:text-purple-300/60 text-sm transition-colors">
          Admin
        </Link>
        <span className="text-purple-300/20">/</span>
        <span className="text-sm text-neutral-100">Auditoria</span>
      </div>
      <h1 className="text-xl font-bold text-neutral-100 mb-6">Log de Auditoria</h1>

      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-5 h-5 border-2 border-purple-800/30 border-t-emerald-500 rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-purple-300/40 p-6 text-center">Nenhum registro de auditoria.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-purple-300/50 border-b border-purple-800/20">
                <th className="text-left py-3 px-4">Data</th>
                <th className="text-left py-3 px-4">Usuario</th>
                <th className="text-left py-3 px-4">Entidade</th>
                <th className="text-left py-3 px-4">Acao</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-purple-800/10 hover:bg-purple-800/10">
                  <td className="py-2.5 px-4 text-purple-300/60 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-4 text-neutral-200">{log.user_name}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-1.5 py-0.5 rounded bg-purple-800/20 text-purple-300/60">
                      {log.entity}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-neutral-300">{log.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-purple-800/20">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-xs bg-purple-800/20 text-purple-300/60 rounded disabled:opacity-30 hover:bg-purple-800/30 transition-colors"
            >
              Anterior
            </button>
            <span className="text-xs text-purple-300/40">Pagina {page} de {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-xs bg-purple-800/20 text-purple-300/60 rounded disabled:opacity-30 hover:bg-purple-800/30 transition-colors"
            >
              Proxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
