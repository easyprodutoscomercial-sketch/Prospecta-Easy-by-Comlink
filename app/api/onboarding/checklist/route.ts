import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

const CHECKLIST_STEPS = [
  { key: 'create_pipeline', label: 'Criar primeiro pipeline', auto: true },
  { key: 'add_contact', label: 'Adicionar primeiro contato', auto: true },
  { key: 'add_interaction', label: 'Registrar primeira interacao', auto: true },
  { key: 'invite_user', label: 'Convidar um colega', auto: false },
  { key: 'configure_stages', label: 'Configurar etapas do pipeline', auto: false },
];

// GET /api/onboarding/checklist - Auto-detect completed steps + manual marks
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const orgId = profile.organization_id;

    // Auto-detect steps
    const [pipelinesRes, contactsRes, interactionsRes, usersRes, manualRes] = await Promise.all([
      admin.from('pipelines').select('id').eq('organization_id', orgId).limit(1),
      admin.from('contacts').select('id').eq('organization_id', orgId).limit(1),
      admin.from('interactions').select('id').eq('organization_id', orgId).limit(1),
      admin.from('profiles').select('user_id').eq('organization_id', orgId),
      admin.from('onboarding_checklist').select('step_key, completed_at').eq('organization_id', orgId).eq('user_id', user.id),
    ]);

    const manualSteps = new Set((manualRes.data || []).map((s: any) => s.step_key));
    const hasMultipleUsers = (usersRes.data || []).length > 1;

    const steps = CHECKLIST_STEPS.map((step) => {
      let completed = manualSteps.has(step.key);

      // Auto-detection
      if (step.key === 'create_pipeline' && (pipelinesRes.data || []).length > 0) completed = true;
      if (step.key === 'add_contact' && (contactsRes.data || []).length > 0) completed = true;
      if (step.key === 'add_interaction' && (interactionsRes.data || []).length > 0) completed = true;
      if (step.key === 'invite_user' && hasMultipleUsers) completed = true;

      return { ...step, completed };
    });

    const completedCount = steps.filter((s) => s.completed).length;
    const totalCount = steps.length;

    return NextResponse.json({
      steps,
      completedCount,
      totalCount,
      allDone: completedCount === totalCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/onboarding/checklist - Mark a step as completed manually
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const body = await request.json();
    const admin = getAdminClient();

    await admin.from('onboarding_checklist').upsert({
      organization_id: profile.organization_id,
      user_id: user.id,
      step_key: body.step_key,
    }, { onConflict: 'organization_id,user_id,step_key' });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
