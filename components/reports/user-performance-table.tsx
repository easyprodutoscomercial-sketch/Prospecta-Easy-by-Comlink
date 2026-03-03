'use client';

interface UserPerf {
  user_id: string;
  user_name: string;
  contacts_total: number;
  contacts_won: number;
  contacts_lost: number;
  interactions_count: number;
  total_value: number;
}

interface UserPerformanceTableProps {
  data: UserPerf[];
}

export function UserPerformanceTable({ data }: UserPerformanceTableProps) {
  if (data.length === 0) return <p className="text-xs text-purple-300/40 py-4">Sem dados</p>;

  return (
    <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-4 overflow-x-auto">
      <h3 className="text-sm font-medium text-neutral-100 mb-3">Performance por Usuario</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-purple-300/50 border-b border-purple-800/20">
            <th className="text-left py-2 pr-3">Usuario</th>
            <th className="text-right py-2 px-2">Contatos</th>
            <th className="text-right py-2 px-2">Ganhos</th>
            <th className="text-right py-2 px-2">Perdidos</th>
            <th className="text-right py-2 px-2">Interacoes</th>
            <th className="text-right py-2 pl-2">Valor Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map((u) => (
            <tr key={u.user_id} className="border-b border-purple-800/10 hover:bg-purple-800/10">
              <td className="py-2 pr-3 text-neutral-200 font-medium">{u.user_name}</td>
              <td className="py-2 px-2 text-right text-neutral-300">{u.contacts_total}</td>
              <td className="py-2 px-2 text-right text-emerald-400">{u.contacts_won}</td>
              <td className="py-2 px-2 text-right text-red-400">{u.contacts_lost}</td>
              <td className="py-2 px-2 text-right text-blue-400">{u.interactions_count}</td>
              <td className="py-2 pl-2 text-right text-amber-400">
                {u.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
