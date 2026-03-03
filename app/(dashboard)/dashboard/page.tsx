import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import DailyTasksWidget from '@/components/daily-tasks-widget';
import PipelineHealthWidget from '@/components/ai/pipeline-health-widget';
import PipelineDashboard from '@/components/dashboard/pipeline-dashboard';
import { SetupChecklist } from '@/components/onboarding/setup-checklist';
import { PushNotificationPrompt } from '@/components/push-notification-prompt';
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

  // Fetch all data in parallel (4 queries)
  const [contactsResult, interactionsResult, meetingsResult, profilesResult] = await Promise.all([
    admin.from('contacts').select('id, name, email, phone, company, status, stage_id, pipeline_id, valor_estimado, created_at, created_by_user_id').eq('organization_id', orgId),
    admin.from('interactions').select('contact_id, type, outcome, created_by_user_id, created_at').eq('organization_id', orgId),
    admin.from('meetings').select('id, title, meeting_at, status, contact_id, created_by_user_id').eq('organization_id', orgId),
    admin.from('profiles').select('user_id, name, avatar_url').eq('organization_id', orgId),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-emerald-400 mb-8">Dashboard</h1>
      <PushNotificationPrompt />
      <SetupChecklist />
      <DailyTasksWidget />
      <PipelineHealthWidget />
      <PipelineDashboard
        contacts={contactsResult.data || []}
        interactions={interactionsResult.data || []}
        meetings={meetingsResult.data || []}
        profiles={profilesResult.data || []}
      />
    </div>
  );
}
