import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import DashboardCharts from '@/components/dashboard-charts';

export const dynamic = 'force-dynamic';

const STATUS_CONFIG = [
  { key: 'NOVO', label: 'Novo', color: '#a3a3a3' },
  { key: 'EM_PROSPECCAO', label: 'Em Prospecção', color: '#f59e0b' },
  { key: 'CONTATADO', label: 'Contatado', color: '#3b82f6' },
  { key: 'REUNIAO_MARCADA', label: 'Reunião Marcada', color: '#22c55e' },
  { key: 'CONVERTIDO', label: 'Convertido', color: '#10b981' },
  { key: 'PERDIDO', label: 'Perdido', color: '#ef4444' },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;

  // Count by status
  const statusCounts = await Promise.all(
    STATUS_CONFIG.map(async (s) => {
      const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('status', s.key);
      return { name: s.label, value: count || 0, color: s.color };
    })
  );

  const totalContacts = statusCounts.reduce((sum, s) => sum + s.value, 0);

  // Monthly data (last 6 months)
  const now = new Date();
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();

    const { count } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .gte('created_at', start)
      .lt('created_at', end);

    const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    monthlyData.push({ month: label, count: count || 0 });
  }

  // Recent contacts
  const { data: recentContacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Key metrics from statusCounts
  const emProspeccao = statusCounts.find((s) => s.name === 'Em Prospecção')?.value || 0;
  const reunioesMarcadas = statusCounts.find((s) => s.name === 'Reunião Marcada')?.value || 0;
  const convertidos = statusCounts.find((s) => s.name === 'Convertido')?.value || 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-8">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="border border-neutral-200 p-5 rounded-lg">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Total de Contatos</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{totalContacts}</p>
        </div>
        <div className="border border-neutral-200 p-5 rounded-lg">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Em Prospecção</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{emProspeccao}</p>
        </div>
        <div className="border border-neutral-200 p-5 rounded-lg">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Reuniões Marcadas</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{reunioesMarcadas}</p>
        </div>
        <div className="border border-neutral-200 p-5 rounded-lg">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Convertidos</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{convertidos}</p>
        </div>
      </div>

      {/* Charts */}
      <DashboardCharts statusData={statusCounts} monthlyData={monthlyData} />

      {/* Recent contacts */}
      <div className="border border-neutral-200 rounded-lg">
        <div className="px-5 py-4 flex justify-between items-center">
          <h2 className="text-sm font-medium text-neutral-900">Contatos Recentes</h2>
          <Link href="/contacts" className="text-xs text-neutral-500 hover:text-neutral-900">
            Ver todos
          </Link>
        </div>
        <div className="divide-y divide-neutral-100">
          {recentContacts && recentContacts.length > 0 ? (
            recentContacts.map((contact) => (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="px-5 py-3 hover:bg-neutral-50 flex justify-between items-center block transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">{contact.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {contact.email || contact.phone || contact.company || '-'}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>
                  {formatStatus(contact.status)}
                </span>
              </Link>
            ))
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-neutral-500">Nenhum contato cadastrado ainda.</p>
              <Link href="/contacts/new" className="text-sm text-neutral-900 hover:underline font-medium mt-1 inline-block">
                Criar primeiro contato
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    NOVO: 'Novo',
    EM_PROSPECCAO: 'Em Prospecção',
    CONTATADO: 'Contatado',
    REUNIAO_MARCADA: 'Reunião Marcada',
    CONVERTIDO: 'Convertido',
    PERDIDO: 'Perdido',
  };
  return labels[status] || status.replace(/_/g, ' ');
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    NOVO: 'bg-neutral-100 text-neutral-700',
    EM_PROSPECCAO: 'bg-amber-100 text-amber-700',
    CONTATADO: 'bg-blue-100 text-blue-700',
    REUNIAO_MARCADA: 'bg-green-100 text-green-700',
    CONVERTIDO: 'bg-emerald-100 text-emerald-700',
    PERDIDO: 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-neutral-100 text-neutral-700';
}
