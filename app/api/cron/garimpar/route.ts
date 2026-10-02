import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { garimpar, PERFIS } from '@/lib/indicacoes/osm';

// GET /api/cron/garimpar?secret=...
//
// Garimpa UMA cidade por rodada, em segundo plano, e guarda o resultado.
// Existe porque o caminho anterior estava errado: a busca rodava dentro da
// requisicao que o vendedor esperava, e a funcao da Vercel morria com 504
// antes do mapa responder (confirmado no console do navegador).
//
// Agora o botao so LE o que ja esta guardado — resposta instantanea, nunca
// trava — e este robo vai enchendo o cache cidade por cidade. Uma cidade a
// cada rodada tambem e educado com os servidores do Overpass, que sao doados.

export const maxDuration = 60;
const DIAS_CACHE = 7;

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: 'CRON_SECRET obrigatorio' }, { status: 500 });

  const enviado = request.nextUrl.searchParams.get('secret')
    || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (enviado !== segredo) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

  const admin = getAdminClient();

  try {
    const { data: orgs } = await admin.from('organizations').select('id');
    const relatorio: unknown[] = [];

    for (const org of orgs || []) {
      // cidades onde a empresa tem cliente, as mais populosas primeiro
      const { data: contatos } = await admin
        .from('contacts')
        .select('cidade, estado')
        .eq('organization_id', org.id)
        .not('cidade', 'is', null)
        .limit(1000);

      if (!contatos?.length) continue;

      const contagem = new Map<string, { cidade: string; estado: string | null; n: number }>();
      for (const c of contatos) {
        const k = `${(c.cidade || '').toLowerCase()}|${c.estado || ''}`;
        const atual = contagem.get(k);
        if (atual) atual.n++;
        else contagem.set(k, { cidade: c.cidade!, estado: c.estado, n: 1 });
      }

      const cidades = [...contagem.values()].sort((a, b) => b.n - a.n).slice(0, 40);

      // o que ja esta guardado e ainda vale
      const { data: cache } = await admin
        .from('ai_analysis_cache')
        .select('cache_key')
        .eq('organization_id', org.id)
        .eq('analysis_type', 'INDICACOES_OSM')
        .gt('expires_at', new Date().toISOString());

      const prontas = new Set((cache || []).map((c) => c.cache_key));
      const perfil = 'tudo';

      const alvo = cidades.find(
        (c) => !prontas.has(`${c.cidade.toLowerCase()}|${c.estado || ''}|${perfil}`)
      );

      if (!alvo) {
        relatorio.push({ org: org.id, situacao: 'todas as cidades ja garimpadas' });
        continue;
      }

      try {
        const r = await garimpar(alvo.cidade, alvo.estado, perfil);
        await admin.from('ai_analysis_cache').insert({
          organization_id: org.id,
          analysis_type: 'INDICACOES_OSM',
          cache_key: `${alvo.cidade.toLowerCase()}|${alvo.estado || ''}|${perfil}`,
          result: { empresas: r.empresas, cidade: alvo.cidade, estado: alvo.estado, perfil },
          expires_at: new Date(Date.now() + DIAS_CACHE * 864e5).toISOString(),
        });
        relatorio.push({ cidade: alvo.cidade, empresas: r.empresas.length, clientes_la: alvo.n });
      } catch (e) {
        // servidor publico fora do ar: nao guarda nada e tenta de novo na proxima rodada
        relatorio.push({ cidade: alvo.cidade, erro: e instanceof Error ? e.message.slice(0, 120) : 'falhou' });
      }
    }

    return NextResponse.json({ ok: true, perfis: Object.keys(PERFIS), relatorio });
  } catch (e) {
    console.error('[cron garimpar]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
