import { NextRequest, NextResponse } from 'next/server';
import { contexto } from '@/lib/indicacoes/contexto';
import { chatCompletion } from '@/lib/ai/openai';
import { normalizePhone } from '@/lib/utils/normalize';

// POST /api/contacts/:id/mensagem-indicacao -> mensagem de WhatsApp pronta pra uma empresa indicada
// (pedido do dono em 06/10). :id e a EMPRESA INDICADA (rascunho ou ja no funil).
// Gera uma vez (~R$0,01) e guarda: clicar de novo reaproveita sem custo.
// Devolve tambem o link wa.me quando a empresa tem telefone.
//
// Nunca cita o nome do cliente de referencia: e cliente nosso, nao pode ser exposto
// pra um prospect. A mensagem fala do RAMO ("atendemos empresas de ... na regiao").

// Nome da empresa que assina a mensagem. Troque aqui (ou na variavel NOME_EMPRESA) se mudar.
const NOME_EMPRESA = process.env.NOME_EMPRESA || 'Easy Comlink';
const TIPO = 'INDICACAO_MSG';

function linkWhatsApp(...numeros: (string | null)[]) {
  for (const n of numeros) {
    const d = normalizePhone(n);
    if (d && (d.length === 10 || d.length === 11)) return `https://wa.me/55${d}`;
    if (d && d.startsWith('55') && (d.length === 12 || d.length === 13)) return `https://wa.me/${d}`;
  }
  return null;
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await contexto(id);
    if (ctx.erro) return ctx.erro;
    const { admin, contato, profile } = ctx;

    const { data: extra } = await admin.from('contacts').select('phone, whatsapp, contato_nome')
      .eq('id', contato.id).eq('organization_id', contato.organization_id).single();
    const link = linkWhatsApp(extra?.whatsapp ?? null, extra?.phone ?? null);

    const { data: guardada } = await admin.from('ai_analysis_cache').select('result')
      .eq('organization_id', contato.organization_id).eq('analysis_type', TIPO).eq('cache_key', contato.id).maybeSingle();
    const pronta = (guardada?.result as { mensagem?: string } | null)?.mensagem;
    if (pronta) return NextResponse.json({ mensagem: pronta, link, reaproveitada: true });

    // as notas da indicacao trazem o porque ("Nota da IA: 8/10 — ...", "O que faz: ...")
    const notas = (contato.notes || '').split('\n')
      .filter((l) => !/^Indicação a partir de/i.test(l) && !/^Fonte:/i.test(l)).join('\n').slice(0, 800);
    const mensagem = (await chatCompletion({
      messages: [
        {
          role: 'system',
          content: `Você escreve a PRIMEIRA mensagem de WhatsApp de um vendedor B2B brasileiro para uma empresa que ele ainda não conhece.
Regras:
- 3 a 5 linhas, português do Brasil, tom cordial e direto, no máximo 1 emoji.
- Apresente o vendedor e a empresa dele, diga em uma frase por que escolheu ESTA empresa (pelo ramo/atividade dela) e termine pedindo uma conversa rápida.
- NUNCA cite nomes de outros clientes. Não invente produto, preço, prazo nem números.
- Se souber o nome da pessoa de contato, cumprimente pelo nome; senão, "Olá, tudo bem?".
- Responda só com a mensagem pronta, sem aspas.`,
        },
        {
          role: 'user',
          content: `Vendedor: ${profile.name} — ${NOME_EMPRESA}
Empresa que vai receber: ${contato.company || contato.name}${contato.cidade ? ` (${contato.cidade}${contato.estado ? `/${contato.estado}` : ''})` : ''}
${contato.segmento ? `Ramo: ${contato.segmento}\n` : ''}${extra?.contato_nome ? `Pessoa de contato: ${extra.contato_nome}\n` : ''}O que sabemos dela:
${notas || '(pouca informação)'}`,
        },
      ],
      maxTokens: 300,
      temperature: 0.6,
    })).trim();

    if (!mensagem) return NextResponse.json({ erro: 'A IA não devolveu mensagem. Tente de novo.' }, { status: 502 });
    await admin.from('ai_analysis_cache').insert({
      organization_id: contato.organization_id, analysis_type: TIPO, cache_key: contato.id,
      result: { mensagem, user_id: profile.user_id },
      expires_at: new Date(Date.now() + 365 * 864e5).toISOString(),
    });
    console.log('[mensagem indicacao] gerada', JSON.stringify({ contato: contato.id, user: profile.user_id, tamanho: mensagem.length, temLink: !!link }));
    return NextResponse.json({ mensagem, link });
  } catch (e) {
    console.error('[mensagem indicacao]', e);
    return NextResponse.json({ erro: 'Não consegui escrever a mensagem agora. Tente de novo.' }, { status: 500 });
  }
}
