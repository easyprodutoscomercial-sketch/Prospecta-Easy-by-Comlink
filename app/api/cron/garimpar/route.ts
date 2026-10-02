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
//
// Cada rodada deixa um diario em ai_analysis_cache (analysis_type GARIMPO_LOG),
// legivel sem acesso aos logs da Vercel.

export const maxDuration = 60;
const DIAS_CACHE = 7;
const DIAS_LOG = 3;
// Cidade que falhou fica de lado por um tempo. Antes o robo tentava sempre a
// mesma: Campinas dava 504 toda rodada e travou a fila inteira atras dela
// (02/10: so Ribeirao Preto tinha sido garimpada).
const HORAS_ESPERA_FALHA = 2;
// folga pra gravar resultado e diario antes da Vercel cortar aos 60s
const PRAZO_MS = 50000;

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: 'CRON_SECRET obrigatorio' }, { status: 500 });

  const enviado = request.nextUrl.searchParams.get('secret')
    || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (enviado !== segredo) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

  const admin = getAdminClient();
  const inicio = Date.now();
  const prazo = inicio + PRAZO_MS;
  const rodada = new Date(inicio).toISOString();
  console.log('[garimpo] rodada iniciada', rodada);

  try {
    const { data: orgs } = await admin.from('organizations').select('id');
    const relatorio: unknown[] = [];

    for (const org of orgs || []) {
      const passos: { t: number; passo: string; [k: string]: unknown }[] = [];
      const log = (passo: string, detalhe: Record<string, unknown> = {}) => {
        passos.push({ t: Date.now() - inicio, passo, ...detalhe });
        console.log(`[garimpo] org=${org.id} ${passo}`, JSON.stringify(detalhe));
      };
      const gravarDiario = async (resumo: Record<string, unknown>) => {
        const { error } = await admin.from('ai_analysis_cache').insert({
          organization_id: org.id,
          analysis_type: 'GARIMPO_LOG',
          cache_key: rodada,
          result: { ...resumo, passos },
          expires_at: new Date(Date.now() + DIAS_LOG * 864e5).toISOString(),
        });
        if (error) console.error('[garimpo] falha ao gravar diario', error.message);
      };

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
      const perfil = 'tudo';
      const chaveDe = (c: { cidade: string; estado: string | null }) =>
        `${c.cidade.toLowerCase()}|${c.estado || ''}|${perfil}`;

      // o que ja esta guardado e ainda vale, e o que falhou ha pouco
      const agoraIso = new Date().toISOString();
      const [{ data: cache }, { data: falhas }] = await Promise.all([
        admin.from('ai_analysis_cache').select('cache_key')
          .eq('organization_id', org.id).eq('analysis_type', 'INDICACOES_OSM').gt('expires_at', agoraIso),
        admin.from('ai_analysis_cache').select('cache_key')
          .eq('organization_id', org.id).eq('analysis_type', 'INDICACOES_OSM_FALHA').gt('expires_at', agoraIso),
      ]);

      const prontas = new Set((cache || []).map((c) => c.cache_key));
      const emEspera = new Set((falhas || []).map((c) => c.cache_key));

      const alvo = cidades.find((c) => !prontas.has(chaveDe(c)) && !emEspera.has(chaveDe(c)));

      log('fila', {
        cidades: cidades.length,
        prontas: cidades.filter((c) => prontas.has(chaveDe(c))).length,
        em_espera_por_falha: cidades.filter((c) => emEspera.has(chaveDe(c))).map((c) => c.cidade),
        alvo: alvo ? `${alvo.cidade}/${alvo.estado || ''}` : null,
      });

      if (!alvo) {
        relatorio.push({ org: org.id, situacao: 'nenhuma cidade disponivel nesta rodada' });
        await gravarDiario({ situacao: 'nada a fazer' });
        continue;
      }

      if (prazo - Date.now() < 15000) {
        log('sem-tempo', { restaMs: prazo - Date.now() });
        relatorio.push({ org: org.id, situacao: 'sem tempo nesta rodada' });
        await gravarDiario({ cidade: alvo.cidade, situacao: 'sem tempo' });
        continue;
      }

      const chave = chaveDe(alvo);
      try {
        const r = await garimpar(alvo.cidade, alvo.estado, perfil, { prazo, log });
        await admin.from('ai_analysis_cache').insert({
          organization_id: org.id,
          analysis_type: 'INDICACOES_OSM',
          cache_key: chave,
          result: { empresas: r.empresas, cidade: alvo.cidade, estado: alvo.estado, perfil },
          expires_at: new Date(Date.now() + DIAS_CACHE * 864e5).toISOString(),
        });
        log('guardado', { empresas: r.empresas.length });
        relatorio.push({ cidade: alvo.cidade, empresas: r.empresas.length, clientes_la: alvo.n });
        await gravarDiario({ cidade: alvo.cidade, ok: true, empresas: r.empresas.length });
      } catch (e) {
        // servidor publico fora do ar: marca a cidade pra esperar e a proxima
        // rodada segue a fila em vez de bater de novo na mesma
        const erro = e instanceof Error ? e.message.slice(0, 300) : 'falhou';
        log('falhou', { erro });
        await admin.from('ai_analysis_cache').insert({
          organization_id: org.id,
          analysis_type: 'INDICACOES_OSM_FALHA',
          cache_key: chave,
          result: { cidade: alvo.cidade, estado: alvo.estado, erro, quando: new Date().toISOString() },
          expires_at: new Date(Date.now() + HORAS_ESPERA_FALHA * 36e5).toISOString(),
        });
        relatorio.push({ cidade: alvo.cidade, erro });
        await gravarDiario({ cidade: alvo.cidade, ok: false, erro });
      }
    }

    console.log('[garimpo] rodada terminada', { ms: Date.now() - inicio });
    return NextResponse.json({ ok: true, ms: Date.now() - inicio, perfis: Object.keys(PERFIS), relatorio });
  } catch (e) {
    console.error('[garimpo] erro geral', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
