import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { normalizePhone, normalizeEmail } from '@/lib/utils/normalize';

// API PUBLICA (sem auth) usada pelo fluxo de QR code do contato avulso.
//
// Cenario: vendedor na feira cria um rascunho de contato avulso (is_draft=true),
// a tela mostra um QR code. O cliente aponta o celular, abre este fluxo e
// preenche os proprios dados. Os dados caem direto no rascunho que o vendedor
// tem aberto. Vendedor clica "Atualizar" pra puxar o que o cliente escreveu.
//
// Seguranca:
//   - So aceita contatos com is_draft=true (nunca vaza/edita contato finalizado)
//   - So aceita se o evento vinculado estiver ATIVO
//   - O UUID do contato ja serve como "token" — e random o suficiente e so e
//     util enquanto o rascunho existe. Nao exige token separado.

// GET — retorna os campos atuais do rascunho pra pre-preencher o form do cliente
// (caso o vendedor ja tenha digitado algo antes).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    const admin = getAdminClient();

    const { data: contact } = await admin
      .from('contacts')
      .select('id, name, company, cargo, phone, email, is_draft, event_id, notes, created_by_user_id')
      .eq('id', contactId)
      .maybeSingle();

    if (!contact || !contact.is_draft) {
      return NextResponse.json(
        { error: 'Rascunho nao encontrado ou ja finalizado' },
        { status: 404 }
      );
    }

    // Se tem evento vinculado, valida que esta ativo
    let eventName: string | null = null;
    if (contact.event_id) {
      const { data: event } = await admin
        .from('events')
        .select('id, name, status')
        .eq('id', contact.event_id)
        .maybeSingle();

      if (!event || event.status !== 'ATIVO') {
        return NextResponse.json(
          { error: 'Feira nao esta ativa' },
          { status: 403 }
        );
      }
      eventName = event.name;
    }

    // Busca dados do vendedor (quem criou o rascunho) pra mostrar pro cliente
    // — isso da confianca pro cliente de que esta preenchendo pra pessoa certa.
    let seller: { name: string; avatar_url: string | null } | null = null;
    if (contact.created_by_user_id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('name, avatar_url')
        .eq('user_id', contact.created_by_user_id)
        .maybeSingle();
      if (profile) {
        seller = {
          name: profile.name || 'Vendedor',
          avatar_url: profile.avatar_url || null,
        };
      }
    }

    // Nao expoe nome placeholder ao cliente
    const displayName = contact.name === '(rascunho)' ? '' : contact.name || '';

    return NextResponse.json({
      id: contact.id,
      name: displayName,
      company: contact.company || '',
      cargo: contact.cargo || '',
      phone: contact.phone || '',
      email: contact.email || '',
      seller,
      event_name: eventName,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar rascunho' },
      { status: 500 }
    );
  }
}

// POST — cliente submete os dados dele pro rascunho.
// Nao finaliza (is_draft continua true). O vendedor e quem finaliza depois.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    const admin = getAdminClient();

    const body = await request.json();
    const name: string = (body.name || '').trim();
    const company: string = (body.company || '').trim();
    const cargo: string = (body.cargo || '').trim();
    const phone: string = (body.phone || '').trim();
    const email: string = (body.email || '').trim();

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: 'Nome e obrigatorio (min 2 caracteres)' },
        { status: 400 }
      );
    }

    // Valida rascunho existe e esta em feira ATIVA (mesmo check do GET)
    const { data: contact } = await admin
      .from('contacts')
      .select('id, is_draft, event_id')
      .eq('id', contactId)
      .maybeSingle();

    if (!contact || !contact.is_draft) {
      return NextResponse.json(
        { error: 'Rascunho nao encontrado ou ja finalizado' },
        { status: 404 }
      );
    }

    if (contact.event_id) {
      const { data: event } = await admin
        .from('events')
        .select('status')
        .eq('id', contact.event_id)
        .maybeSingle();

      if (!event || event.status !== 'ATIVO') {
        return NextResponse.json(
          { error: 'Feira nao esta ativa' },
          { status: 403 }
        );
      }
    }

    // Monta patch. Nao mexe em is_draft — o vendedor que finaliza.
    const patch: Record<string, any> = {
      name,
      name_normalized: name.toLowerCase(),
    };
    if (company) patch.company = company;
    if (cargo) patch.cargo = cargo;
    if (phone) {
      patch.phone = phone;
      patch.whatsapp = phone;
      const phoneNorm = normalizePhone(phone);
      if (phoneNorm) patch.phone_normalized = phoneNorm;
    }
    if (email) {
      patch.email = email;
      const emailNorm = normalizeEmail(email);
      if (emailNorm) patch.email_normalized = emailNorm;
    }

    const { error: updateErr } = await admin
      .from('contacts')
      .update(patch)
      .eq('id', contactId)
      .eq('is_draft', true); // garantia extra contra race condition de finalizacao

    if (updateErr) {
      console.error('[public walkin-fill] update error:', updateErr);
      return NextResponse.json(
        { error: 'Erro ao salvar dados' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar dados' },
      { status: 500 }
    );
  }
}
