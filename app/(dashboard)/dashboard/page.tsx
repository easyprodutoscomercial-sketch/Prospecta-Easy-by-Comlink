import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import DashboardWithTabs from '@/components/dashboard-with-tabs';
import DailyTasksWidget from '@/components/daily-tasks-widget';
import PipelineHealthWidget from '@/components/ai/pipeline-health-widget';
import { ensureProfile } from '@/lib/ensure-profile';

export const dynamic = 'force-dynamic';

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
    admin.from('contacts').select('id, status, created_at, created_by_user_id, tipo, valor_estimado, assigned_to_user_id, temperatura, origem, classe, estado, cidade, proxima_acao_tipo, cpf, cnpj, phone, whatsapp, company, referencia, contato_nome, cargo, produtos_fornecidos').eq('organization_id', orgId),
    admin.from('contacts').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(20),
    admin.from('interactions').select('contact_id, type, outcome, created_by_user_id, created_at').eq('organization_id', orgId),
    admin.from('profiles').select('user_id, name, avatar_url').eq('organization_id', orgId),
    admin.from('contacts').select('id, created_by_user_id, tipo, temperatura, origem, classe, assigned_to_user_id, estado, cidade, proxima_acao_tipo, cpf, cnpj, phone, whatsapp, company, referencia, contato_nome, cargo, produtos_fornecidos').eq('organization_id', orgId).gte('created_at', monthStart).lt('created_at', monthEnd),
    admin.from('interactions').select('contact_id, created_by_user_id, type, outcome').eq('organization_id', orgId).gte('created_at', monthStart).lt('created_at', monthEnd),
  ]);

  const allContacts = contactsResult.data || [];
  const recentContacts = recentResult.data || [];
  const allInteractions = interactionsResult.data || [];
  const allProfiles = profilesResult.data || [];
  const monthContacts = monthContactsResult.data || [];
  const monthInteractions = monthInteractionsResult.data || [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-emerald-400 mb-8">Dashboard</h1>
      <DailyTasksWidget />
      <PipelineHealthWidget />
      <DashboardWithTabs
        allContacts={allContacts}
        recentContacts={recentContacts}
        allInteractions={allInteractions}
        allProfiles={allProfiles}
        monthContacts={monthContacts}
        monthInteractions={monthInteractions}
        monthRanges={monthRanges}
      />
    </div>
  );
}
