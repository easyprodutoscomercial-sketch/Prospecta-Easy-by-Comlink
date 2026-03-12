import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/utils/normalize';

export const dynamic = 'force-dynamic';

// GET /api/quiz?token=xxx — Public quiz config (no auth)
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: config, error } = await admin
      .from('quiz_configuracoes')
      .select('id, quiz_ativo, nome_evento, descricao_desafio, mensagem_pausa, token_publico')
      .eq('token_publico', token)
      .single();

    if (error || !config) {
      return NextResponse.json({ error: 'Quiz não encontrado' }, { status: 404 });
    }

    // Count participants for this quiz
    const { count } = await admin
      .from('quiz_participantes')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_config_id', config.id);

    return NextResponse.json({
      id: config.id,
      quiz_ativo: config.quiz_ativo,
      nome_evento: config.nome_evento,
      descricao_desafio: config.descricao_desafio,
      mensagem_pausa: config.mensagem_pausa,
      total_participantes: count || 0,
    });
  } catch (error: any) {
    console.error('Error fetching quiz config:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST /api/quiz — Register participant (no auth, via token)
export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const body = await request.json();
    const { token, nome, empresa, telefone, palpite } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 });
    }
    if (!nome || nome.trim().length < 2) {
      return NextResponse.json({ error: 'Nome é obrigatório (min 2 caracteres)' }, { status: 400 });
    }
    if (!empresa || empresa.trim().length < 2) {
      return NextResponse.json({ error: 'Empresa é obrigatória' }, { status: 400 });
    }
    if (!telefone || telefone.trim().length < 8) {
      return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 });
    }
    if (palpite === undefined || palpite === null || isNaN(Number(palpite)) || Number(palpite) < 1) {
      return NextResponse.json({ error: 'Palpite deve ser um número positivo' }, { status: 400 });
    }

    // Find quiz config
    const { data: config, error: configError } = await admin
      .from('quiz_configuracoes')
      .select('*')
      .eq('token_publico', token)
      .single();

    if (configError || !config) {
      return NextResponse.json({ error: 'Quiz não encontrado' }, { status: 404 });
    }

    if (!config.quiz_ativo) {
      return NextResponse.json({ error: 'Quiz está pausado no momento' }, { status: 410 });
    }

    // Check for duplicate phone in this quiz
    const phoneNormalized = normalizePhone(telefone);
    if (phoneNormalized) {
      const { data: existing } = await admin
        .from('quiz_participantes')
        .select('id')
        .eq('quiz_config_id', config.id)
        .eq('telefone', phoneNormalized)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: 'Você já participou deste quiz! Boa sorte!',
        });
      }
    }

    let contactId: string | null = null;

    // Create contact in CRM (always, when pipeline is configured)
    // Wrapped in try/catch so participant is saved even if contact creation fails
    if (config.pipeline_id) {
      try {
        const { data: firstStage } = await admin
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', config.pipeline_id)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (firstStage) {
          // Check for duplicate contact by phone
          let existingContact = null;
          if (phoneNormalized) {
            const { data } = await admin
              .from('contacts')
              .select('id')
              .eq('organization_id', config.organization_id)
              .eq('phone_normalized', phoneNormalized)
              .maybeSingle();
            existingContact = data;
          }

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            const contactData: Record<string, any> = {
              organization_id: config.organization_id,
              name: nome.trim(),
              phone: telefone.trim(),
              phone_normalized: phoneNormalized,
              name_normalized: nome.trim().toLowerCase(),
              company: empresa.trim(),
              whatsapp: telefone.trim(),
              pipeline_id: config.pipeline_id,
              stage_id: firstStage.id,
              tipo: [],
            };

            const optionalFields: Record<string, any> = {
              origem: 'FEIRA',
              temperatura: 'MORNO',
              sem_documento: true,
            };

            let { data: newContact, error: insertError } = await admin
              .from('contacts')
              .insert({ ...contactData, ...optionalFields })
              .select('id')
              .single();

            if (insertError) {
              console.warn('Contact insert with optional fields failed, retrying:', insertError.message);
              const { data: retryContact, error: retryError } = await admin
                .from('contacts')
                .insert(contactData)
                .select('id')
                .single();

              if (!retryError && retryContact) {
                contactId = retryContact.id;
              } else if (retryError) {
                console.warn('Contact insert retry also failed:', retryError.message);
              }
            } else if (newContact) {
              contactId = newContact.id;
            }
          }
        }
      } catch (contactErr: any) {
        console.error('Contact creation failed (participant will still be saved):', contactErr.message);
      }
    }

    // Insert participant
    const { data: participant, error: insertError } = await admin
      .from('quiz_participantes')
      .insert({
        organization_id: config.organization_id,
        quiz_config_id: config.id,
        nome: nome.trim(),
        empresa: empresa.trim(),
        telefone: phoneNormalized || telefone.trim(),
        palpite: Number(palpite),
        evento_nome: config.nome_evento,
        contact_id: contactId,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting participant:', insertError.message, insertError.details, insertError.hint);
      return NextResponse.json({ error: `Erro ao registrar participação: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Participação registrada com sucesso!',
      participant_id: participant.id,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error registering participant:', error);
    return NextResponse.json({ error: 'Erro ao registrar participação. Tente novamente.' }, { status: 500 });
  }
}
