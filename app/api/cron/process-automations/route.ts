import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { processTimeBasedRules } from '@/lib/automations/engine';

function assertCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron] CRON_SECRET nao configurada — abortando pra evitar abuso');
    return NextResponse.json({ error: 'CRON_SECRET obrigatorio' }, { status: 500 });
  }
  const secret = request.nextUrl.searchParams.get('secret') ||
                 request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (secret !== cronSecret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  return null;
}

// POST /api/cron/process-automations — called by Vercel cron every 2 hours
export async function POST(request: NextRequest) {
  const authErr = assertCronAuth(request);
  if (authErr) return authErr;

  try {
    const admin = getAdminClient();

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
export async function GET(request: NextRequest) {
  return POST(request);
}
