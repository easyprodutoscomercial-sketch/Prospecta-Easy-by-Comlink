import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { canViewAuditLog } from '@/lib/utils/roles';
import { sendPushToUser } from '@/lib/push/send-push';
import type { UserRole } from '@/lib/types';

// POST /api/conferencia/cobrar { vendedor_id, dia, mensagem }
// Botao "Cobrar no CRM" da conferencia (pedido do dono em 06/10): a cobranca vira notificacao
// do vendedor (sino + aviso de cobranca no topo da tela) e push no celular, se ele ativou.
// A mensagem e montada na tela por lib/conferencia/cobrar.ts e o dono pode editar antes.
// Tipo TASK_OVERDUE: a tabela notifications so aceita os tipos que ja existem (sem DDL);
// metadata.source = 'conferencia' diferencia.

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const profile = await ensureProfile(supabase, user);
    if (!profile || !canViewAuditLog(profile.role as UserRole)) {
      return NextResponse.json({ error: 'Só administrador ou gerente pode cobrar pela conferência.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const vendedorId = typeof body?.vendedor_id === 'string' ? body.vendedor_id : '';
    const dia = typeof body?.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dia) ? body.dia : null;
    const mensagem = typeof body?.mensagem === 'string' ? body.mensagem.trim().slice(0, 4000) : '';
    if (!vendedorId || !dia || !mensagem) return NextResponse.json({ error: 'vendedor_id, dia e mensagem obrigatórios' }, { status: 400 });

    const admin = getAdminClient();
    const { data: vendedor } = await admin.from('profiles').select('user_id, name')
      .eq('organization_id', profile.organization_id).eq('user_id', vendedorId).maybeSingle();
    if (!vendedor) return NextResponse.json({ error: 'Vendedor não encontrado' }, { status: 404 });

    const diaBR = dia.split('-').reverse().slice(0, 2).join('/');
    const titulo = `📋 ${profile.name.split(' ')[0]} pediu ajustes no CRM (relatório de ${diaBR})`;
    const { error } = await admin.from('notifications').insert({
      organization_id: profile.organization_id,
      user_id: vendedorId,
      type: 'TASK_OVERDUE',
      title: titulo,
      body: mensagem,
      metadata: { source: 'conferencia', dia, por: profile.user_id },
      read: false,
      dismissed: false,
    });
    if (error) {
      console.error('[conferencia cobrar]', error.message);
      return NextResponse.json({ error: 'Não consegui mandar a cobrança.' }, { status: 500 });
    }
    // push e bonus: sem chave VAPID ou sem celular cadastrado, segue so com o sino
    let push = 0;
    try { push = await sendPushToUser(admin, vendedorId, { title: titulo, body: mensagem.slice(0, 180), url: '/kanban' }); } catch { /* sem push */ }

    console.log('[conferencia cobrar]', JSON.stringify({ por: profile.user_id, vendedor: vendedorId, dia, tamanho: mensagem.length, push }));
    return NextResponse.json({ ok: true, push });
  } catch (e) {
    console.error('[conferencia cobrar]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
