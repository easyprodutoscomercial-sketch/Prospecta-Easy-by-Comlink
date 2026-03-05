'use client';

import { PcCotacao, PcPedido } from '@/lib/types';

interface PcRecentActivityProps {
  recentCotacoes: PcCotacao[];
  recentPedidos: PcPedido[];
}

type ActivityItem = {
  id: string;
  type: 'cotacao' | 'pedido';
  description: string;
  created_at: string;
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min atras`;
  if (diffHours < 24) return `${diffHours}h atras`;
  if (diffDays < 30) return `${diffDays}d atras`;
  return date.toLocaleDateString('pt-BR');
}

export default function PcRecentActivity({ recentCotacoes, recentPedidos }: PcRecentActivityProps) {
  const items: ActivityItem[] = [
    ...recentCotacoes.map((c) => ({
      id: c.id,
      type: 'cotacao' as const,
      description: `Cotacao #${c.cotacao_numero} - ${c.fornecedor}`,
      created_at: c.created_at,
    })),
    ...recentPedidos.map((p) => ({
      id: p.id,
      type: 'pedido' as const,
      description: `Pedido #${p.pedido_numero} - ${p.empresa}`,
      created_at: p.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-5">
      <h3 className="text-sm font-medium text-neutral-300 mb-4">Atividade Recente</h3>

      {items.length === 0 ? (
        <p className="text-neutral-500 text-sm text-center py-8">Nenhuma atividade recente</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {item.type === 'cotacao' ? (
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-300 truncate">{item.description}</p>
                <p className="text-xs text-neutral-500">{timeAgo(item.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
