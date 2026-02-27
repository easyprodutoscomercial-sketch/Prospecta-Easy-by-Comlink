import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, normalizeEmail } from '@/lib/utils/normalize';

// GET /api/lead-capture?token=xxx - Info publica do link (sem auth)
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token obrigatorio' }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: link, error } = await admin
      .from('lead_capture_links')
      .select('id, token, label, is_active, pipeline_id, user_id')
      .eq('token', token)
      .single();

    if (error || !link) {
      return NextResponse.json({ error: 'Link nao encontrado' }, { status: 404 });
    }

    if (!link.is_active) {
      return NextResponse.json({ error: 'Link inativo', inactive: true }, { status: 410 });
    }

    // Buscar nome do vendedor
    const { data: profile } = await admin
      .from('profiles')
      .select('name')
      .eq('user_id', link.user_id)
      .single();

    // Buscar nome do pipeline
    const { data: pipeline } = await admin
      .from('pipelines')
      .select('name')
      .eq('id', link.pipeline_id)
      .single();

    return NextResponse.json({
      label: link.label,
      user_name: profile?.name || 'Vendedor',
      pipeline_name: pipeline?.name || 'Pipeline',
    });
  } catch (error: any) {
    console.error('Error fetching lead capture info:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST /api/lead-capture - Criar lead via formulario publico (sem auth)
export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const body = await request.json();

    const { token, name, phone, email, company, cargo, notes } = body;

    // Validacoes basicas
    if (!token) {
      return NextResponse.json({ error: 'Token obrigatorio' }, { status: 400 });
    }
    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Nome e obrigatorio (min 2 caracteres)' }, { status: 400 });
    }
    if (!phone || phone.trim().length < 8) {
      return NextResponse.json({ error: 'Telefone/WhatsApp e obrigatorio' }, { status: 400 });
    }

    // Buscar link
    const { data: link, error: linkError } = await admin
      .from('lead_capture_links')
      .select('*')
      .eq('token', token)
      .single();

    if (linkError || !link) {
      return NextResponse.json({ error: 'Link nao encontrado' }, { status: 404 });
    }

    if (!link.is_active) {
      return NextResponse.json({ error: 'Este link foi desativado' }, { status: 410 });
    }

    // Buscar primeiro stage do pipeline
    const { data: firstStage } = await admin
      .from('pipeline_stages')
      .select('id')
      .eq('pipeline_id', link.pipeline_id)
      .order('position', { ascending: true })
      .limit(1)
      .single();

    if (!firstStage) {
      return NextResponse.json({ error: 'Pipeline sem stages configurados' }, { status: 500 });
    }

    // Normalizar para deduplicacao
    const phoneNormalized = normalizePhone(phone);
    const emailNormalized = normalizeEmail(email);

    // Verificar duplicado (mesmo phone ou email na mesma org)
    const dupChecks = [];
    if (phoneNormalized) {
      dupChecks.push(
        admin
          .from('contacts')
          .select('id, name')
          .eq('organization_id', link.organization_id)
          .eq('phone_normalized', phoneNormalized)
          .limit(1)
          .maybeSingle()
      );
    }
    if (emailNormalized) {
      dupChecks.push(
        admin
          .from('contacts')
          .select('id, name')
          .eq('organization_id', link.organization_id)
          .eq('email_normalized', emailNormalized)
          .limit(1)
          .maybeSingle()
      );
    }

    const dupResults = await Promise.all(dupChecks);
    const duplicate = dupResults.find(r => r.data && !r.error);

    if (duplicate?.data) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Seus dados ja estao registrados! Entraremos em contato em breve.',
      });
    }

    // Criar contato
    const { error: insertError } = await admin
      .from('contacts')
      .insert({
        organization_id: link.organization_id,
        name: name.trim(),
        phone: phone.trim(),
        phone_normalized: phoneNormalized,
        email: email?.trim() || null,
        email_normalized: emailNormalized,
        name_normalized: name.trim().toLowerCase(),
        company: company?.trim() || null,
        cargo: cargo?.trim() || null,
        notes: notes?.trim() || null,
        whatsapp: phone.trim(),
        tipo: [],
        origem: 'QRCODE',
        temperatura: 'QUENTE',
        sem_documento: true,
        pipeline_id: link.pipeline_id,
        stage_id: firstStage.id,
        assigned_to_user_id: link.user_id,
        created_by_user_id: link.user_id,
      });

    if (insertError) {
      console.error('Error creating lead via QR:', insertError);
      throw insertError;
    }

    // Incrementar leads_count
    await admin
      .from('lead_capture_links')
      .update({
        leads_count: (link.leads_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', link.id);

    return NextResponse.json({
      success: true,
      message: 'Dados registrados com sucesso! Entraremos em contato em breve.',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating lead capture:', error);
    return NextResponse.json({ error: 'Erro ao registrar dados. Tente novamente.' }, { status: 500 });
  }
}
