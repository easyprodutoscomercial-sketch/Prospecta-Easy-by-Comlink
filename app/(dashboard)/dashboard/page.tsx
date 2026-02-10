import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import DashboardWithTabs, { SegmentData } from '@/components/dashboard-with-tabs';
import { ensureProfile } from '@/lib/ensure-profile';
import { STATUS_CHART_COLORS, STATUS_LABELS, INTERACTION_TYPE_LABELS } from '@/lib/utils/labels';

export const dynamic = 'force-dynamic';

const STATUS_CONFIG = Object.entries(STATUS_LABELS).map(([key, label]) => ({
  key,
  label,
  color: STATUS_CHART_COLORS[key] || '#a3a3a3',
}));

function computeSegment(
  contacts: any[],
  interactions: any[],
  recentContacts: any[],
  allProfiles: any[],
  monthContacts: any[],
  monthInteractions: any[],
  monthRanges: { start: string; end: string; label: string }[]
): SegmentData {
  // Status counts
  const statusMap: Record<string, number> = {};
  for (const c of contacts) {
    statusMap[c.status] = (statusMap[c.status] || 0) + 1;
  }
  const statusCounts = STATUS_CONFIG.map((s) => ({
    name: s.label,
    value: statusMap[s.key] || 0,
    color: s.color,
  }));

  const totalContacts = contacts.length;
  const emProspeccao = statusMap['EM_PROSPECCAO'] || 0;
  const reunioesMarcadas = statusMap['REUNIAO_MARCADA'] || 0;
  const convertidos = statusMap['CONVERTIDO'] || 0;

  // Monthly bar chart
  const monthlyData = monthRanges.map((range) => {
    const count = contacts.filter(
      (c) => c.created_at >= range.start && c.created_at < range.end
    ).length;
    return { month: range.label, count };
  });

  // Interactions by type
  const typeCountMap: Record<string, number> = {};
  for (const i of interactions) {
    typeCountMap[i.type] = (typeCountMap[i.type] || 0) + 1;
  }
  const interactionsByType = Object.entries(INTERACTION_TYPE_LABELS).map(([key, label]) => ({
    name: label,
    count: typeCountMap[key] || 0,
  }));

  // Response rate
  const responded = interactions.filter((i) => i.outcome !== 'SEM_RESPOSTA').length;
  const noResponse = interactions.filter((i) => i.outcome === 'SEM_RESPOSTA').length;
  const totalInteractions = interactions.length;

  // Team comparison (this month)
  const teamComparison = allProfiles.map((p) => {
    const userContacts = monthContacts.filter((c) => c.created_by_user_id === p.user_id).length;
    const userInteractions = monthInteractions.filter((i) => i.created_by_user_id === p.user_id);
    const intCount = userInteractions.length;
    const meetings = userInteractions.filter((i) => i.type === 'REUNIAO' || i.type === 'VISITA').length;
    const conversions = userInteractions.filter((i) =>
      i.outcome === 'CONVERTIDO' || i.outcome === 'PROPOSTA_ACEITA' || i.outcome === 'FECHADO_PARCIAL'
    ).length;
    return {
      name: p.name.split(' ').slice(0, 2).join(' '),
      contacts: userContacts,
      interactions: intCount,
      meetings,
      conversions,
    };
  });

  // Conversion ranking (all time)
  const conversionRanking = allProfiles.map((p) => {
    const userInteractions = interactions.filter((i) => i.created_by_user_id === p.user_id);
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

  return {
    statusCounts,
    totalContacts,
    emProspeccao,
    reunioesMarcadas,
    convertidos,
    monthlyData,
    interactionsByType,
    responded,
    noResponse,
    totalInteractions,
    teamComparison,
    conversionRanking,
    recentContacts: recentContacts.slice(0, 5),
  };
}

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

  // Fetch all data in parallel (include id, tipo for contacts; contact_id for interactions)
  const [
    contactsResult,
    recentResult,
    interactionsResult,
    profilesResult,
    monthContactsResult,
    monthInteractionsResult,
  ] = await Promise.all([
    admin.from('contacts').select('id, status, created_at, created_by_user_id, tipo').eq('organization_id', orgId),
    admin.from('contacts').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(20),
    admin.from('interactions').select('contact_id, type, outcome, created_by_user_id, created_at').eq('organization_id', orgId),
    admin.from('profiles').select('user_id, name').eq('organization_id', orgId),
    admin.from('contacts').select('id, created_by_user_id, tipo').eq('organization_id', orgId).gte('created_at', monthStart).lt('created_at', monthEnd),
    admin.from('interactions').select('contact_id, created_by_user_id, type, outcome').eq('organization_id', orgId).gte('created_at', monthStart).lt('created_at', monthEnd),
  ]);

  const allContacts = contactsResult.data || [];
  const recentContacts = recentResult.data || [];
  const allInteractions = interactionsResult.data || [];
  const allProfiles = profilesResult.data || [];
  const monthContacts = monthContactsResult.data || [];
  const monthInteractions = monthInteractionsResult.data || [];

  // Build contact type map for filtering interactions by contact tipo
  const contactTypeMap = new Map<string, string[]>();
  for (const c of allContacts) {
    contactTypeMap.set(c.id, c.tipo || []);
  }
  // Also include month contacts in the map
  for (const c of monthContacts) {
    if (!contactTypeMap.has(c.id)) {
      contactTypeMap.set(c.id, c.tipo || []);
    }
  }

  // Filter helpers
  const filterContactsByTipo = (items: any[], tipo: string) =>
    items.filter((c) => (c.tipo || []).includes(tipo));

  const filterInteractionsByTipo = (interactions: any[], tipo: string) =>
    interactions.filter((i) => {
      const tipos = contactTypeMap.get(i.contact_id);
      return tipos && tipos.includes(tipo);
    });

  // Compute 3 segments: Geral, Fornecedor, Comprador
  const geral = computeSegment(
    allContacts, allInteractions, recentContacts,
    allProfiles, monthContacts, monthInteractions, monthRanges
  );

  const fornecedor = computeSegment(
    filterContactsByTipo(allContacts, 'FORNECEDOR'),
    filterInteractionsByTipo(allInteractions, 'FORNECEDOR'),
    recentContacts.filter((c) => (c.tipo || []).includes('FORNECEDOR')),
    allProfiles,
    filterContactsByTipo(monthContacts, 'FORNECEDOR'),
    filterInteractionsByTipo(monthInteractions, 'FORNECEDOR'),
    monthRanges
  );

  const comprador = computeSegment(
    filterContactsByTipo(allContacts, 'COMPRADOR'),
    filterInteractionsByTipo(allInteractions, 'COMPRADOR'),
    recentContacts.filter((c) => (c.tipo || []).includes('COMPRADOR')),
    allProfiles,
    filterContactsByTipo(monthContacts, 'COMPRADOR'),
    filterInteractionsByTipo(monthInteractions, 'COMPRADOR'),
    monthRanges
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-8">Dashboard</h1>
      <DashboardWithTabs geral={geral} fornecedor={fornecedor} comprador={comprador} />
    </div>
  );
}
