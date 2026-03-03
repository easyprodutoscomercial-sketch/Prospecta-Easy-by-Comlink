import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { processTimeBasedRules } from '@/lib/automations/engine';

// POST /api/cron/process-automations — called by Vercel cron every 2 hours
export async function POST() {
  try {
    const admin = getAdminClient();

    // Fetch all organizations
    const { data: orgs } = await admin.from('organizations').select('id');
    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ message: 'No organizations', executed: 0 });
    }

    let totalExecuted = 0;
    for (const org of orgs) {
      const count = await processTimeBasedRules(admin, org.id);
      totalExecuted += count;
    }

    return NextResponse.json({ executed: totalExecuted });
  } catch (error: any) {
    console.error('Error in process-automations cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Also support GET for Vercel cron
export async function GET() {
  return POST();
}
