import { NextResponse } from 'next/server';

// Diz qual versao do codigo esta rodando. O navegador consulta de tempos em
// tempos e, quando muda, se recarrega sozinho — ninguem precisa dar F5 pra
// receber uma correcao que ja subiu.
export const dynamic = 'force-dynamic';

export async function GET() {
  const versao =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    'dev';

  return NextResponse.json(
    { versao },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
