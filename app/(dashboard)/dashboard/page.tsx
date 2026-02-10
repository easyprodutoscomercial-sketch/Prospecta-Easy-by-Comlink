import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import DashboardCharts from '@/components/dashboard-charts';
import TeamComparisonChart from '@/components/team-comparison-chart';
import InteractionsByTypeChart from '@/components/interactions-by-type-chart';
import ResponseRateCard from '@/components/response-rate-card';
import ConversionRanking from '@/components/conversion-ranking';
import { ensureProfile } from '@/lib/ensure-profile';
import { STATUS_CHART_COLORS, STATUS_LABELS, INTERACTION_TYPE_LABELS, formatStatus, getStatusColor } from '@/lib/utils/labels';

export const dynamic = 'force-dynamic';

const STATUS_CONFIG = Object.entries(STATUS_LABELS).map(([key, label]) => ({
  key,
  label,
  color: STATUS_CHART_COLORS[key] || '#a3a3a3',
}));

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await ensureProfile(supabase, user);
  if (!profile) return null;

  const admin = getAdminClient();
  const orgId = profile.organization_id;

  // Month ranges for chart
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const monthRanges = Array.from({ length: 6 }, (_, i) => {
    const idx = 5 - i;
    const d = new Date(now.getFullYear(), now.getMonth() - idx, 1);
    return {
      start: d.toISOString(),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString(),
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    };
  });

  // Fetch all data in parallel
  const [
    contactsResult,
    recentResult,
    interactionsResult,
    profilesResult,
    monthContactsResult,
    monthInteractionsResult,
  ] = await Promise.all([
    admin.from('contacts').select('status, created_at, created_by_user_id').eq('organization_id', orgId),
    admin.from('contacts').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(5),
    admin.from('interactions').select('type, outcome, created_by_user_id, created_at').eq('organization_id', orgId),
    admin.from('profiles').select('user_id, name').eq('organization_id', orgId),
    admin.from('contacts').select('created_by_user_id').eq('organization_id', orgId).gte('created_at', monthStart).lt('created_at', monthEnd),
    admin.from('interactions').select('created_by_user_id, type, outcome').eq('organization_id', orgId).gte('created_at', monthStart).lt('created_at', monthEnd),
  ]);

  const allContacts = contactsResult.data || [];
  const recentContacts = recentResult.data || [];
  const allInteractions = interactionsResult.data || [];
  const allProfiles = profilesResult.data || [];
  const monthContacts = monthContactsResult.data || [];
  const monthInteractions = monthInteractionsResult.data || [];

  // === KPI: Status counts ===
  const statusMap: Record<string, number> = {};
  for (const c of allContacts) {
    statusMap[c.status] = (statusMap[c.status] || 0) + 1;
  }

  const statusCounts = STATUS_CONFIG.map((s) => ({
    name: s.label,
    value: statusMap[s.key] || 0,
    color: s.color,
  }));

  const totalContacts = allContacts.length;
  const emProspeccao = statusMap['EM_PROSPECCAO'] || 0;
  const reunioesMarcadas = statusMap['REUNIAO_MARCADA'] || 0;
  const convertidos = statusMap['CONVERTIDO'] || 0;

  // === Monthly bar chart data ===
  const monthlyData = monthRanges.map((range) => {
    const count = allContacts.filter(
      (c) => c.created_at >= range.start && c.created_at < range.end
    ).length;
    return { month: range.label, count };
  });

  // === Interactions by type ===
  const typeCountMap: Record<string, number> = {};
  for (const i of allInteractions) {
    typeCountMap[i.type] = (typeCountMap[i.type] || 0) + 1;
  }
  const interactionsByType = Object.entries(INTERACTION_TYPE_LABELS).map(([key, label]) => ({
    name: label,
    count: typeCountMap[key] || 0,
  }));

  // === Response rate ===
  const responded = allInteractions.filter((i) => i.outcome !== 'SEM_RESPOSTA').length;
  const noResponse = allInteractions.filter((i) => i.outcome === 'SEM_RESPOSTA').length;
  const totalInteractions = allInteractions.length;

  // === Team comparison (this month) ===
  const teamComparison = allProfiles.map((p) => {
    const contacts = monthContacts.filter((c) => c.created_by_user_id === p.user_id).length;
    const userInteractions = monthInteractions.filter((i) => i.created_by_user_id === p.user_id);
    const interactions = userInteractions.length;
    const meetings = userInteractions.filter((i) => i.type === 'REUNIAO' || i.type === 'VISITA').length;
    const conversions = userInteractions.filter((i) =>
      i.outcome === 'CONVERTIDO' || i.outcome === 'PROPOSTA_ACEITA' || i.outcome === 'FECHADO_PARCIAL'
    ).length;

    return {
      name: p.name.split(' ').slice(0, 2).join(' '),
      contacts,
      interactions,
      meetings,
      conversions,
    };
  });

  // === Conversion ranking (all time) ===
  const conversionRanking = allProfiles.map((p) => {
    const userInteractions = allInteractions.filter((i) => i.created_by_user_id === p.user_id);
    const total = userInteractions.length;
    const conversions = userInteractions.filter((i) =>
      i.outcome === 'CONVERTIDO' || i.outcome === 'PROPOSTA_ACEITA' || i.outcome === 'FECHADO_PARCIAL'
    ).length;
    const rate = total > 0 ? Math.round((conversions / total) * 100) : 0;

    return {
      name: p.name,
      conversions,
      total_interactions: total,
      conversion_rate: rate,
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-8">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-neutral-400">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Total de Contatos</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{totalContacts}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-amber-400">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Em Prospecção</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{emProspeccao}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-green-400">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Reuniões Marcadas</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{reunioesMarcadas}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-emerald-400">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Convertidos</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{convertidos}</p>
        </div>
      </div>

      {/* Team comparison chart (full width) */}
      <div className="mb-8">
        <TeamComparisonChart data={teamComparison} />
      </div>

      {/* Charts row: Status + Monthly */}
      <DashboardCharts statusData={statusCounts} monthlyData={monthlyData} />

      {/* Interactions by type + Response rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <InteractionsByTypeChart data={interactionsByType} />
        <ResponseRateCard responded={responded} noResponse={noResponse} total={totalInteractions} />
      </div>

      {/* Conversion ranking + Recent contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversionRanking data={conversionRanking} />

        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-5 py-4 flex justify-between items-center">
            <h2 className="text-sm font-medium text-neutral-900">Contatos Recentes</h2>
            <Link href="/contacts" className="text-xs text-neutral-500 hover:text-neutral-900">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-neutral-100">
            {recentContacts && recentContacts.length > 0 ? (
              recentContacts.map((contact: any) => (
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
    </div>
  );
}
