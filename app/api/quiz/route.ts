import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, normalizeEmail } from '@/lib/utils/normalize';

export const dynamic = 'force-dynamic';

// Get today's date at midnight in São Paulo timezone (avoids UTC midnight bug on Vercel)
function getTodaySP(): Date {
  const sp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  sp.setHours(0, 0, 0, 0);
  return sp;
}

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
      .select('id, quiz_ativo, nome_evento, descricao_desafio, mensagem_pausa, token_publico, data_inicio, dias_feira, dias_config, event_id')
      .eq('token_publico', token)
      .single();

    if (error || !config) {
      return NextResponse.json({ error: 'Quiz não encontrado' }, { status: 404 });
    }

    // If linked to an event, use the event's name and dates as source of truth
    let nomeEvento = config.nome_evento;
    let dataInicio = config.data_inicio;
    let diasFeiraCfg = config.dias_feira;

    if (config.event_id) {
      const { data: event } = await admin
        .from('events')
        .select('name, start_date, end_date')
        .eq('id', config.event_id)
        .single();

      if (event) {
        nomeEvento = event.name || nomeEvento;
        if (event.start_date) dataInicio = event.start_date;
        if (event.start_date && event.end_date) {
          const start = new Date(event.start_date + 'T12:00:00');
          const end = new Date(event.end_date + 'T12:00:00');
          const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
          if (diffDays > 0) diasFeiraCfg = diffDays;
        }
      }
    }

    // Calculate current fair day
    let diaFeira: number | null = null;
    let diasFeira: number | null = null;
    let descricaoDia: string | null = null;
    const diasConfig: any[] = config.dias_config || [];

    if (dataInicio && diasFeiraCfg > 1) {
      diasFeira = diasFeiraCfg;
      const hoje = getTodaySP();
      const inicio = new Date(dataInicio + 'T00:00:00');
      const diffMs = hoje.getTime() - inicio.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      diaFeira = diffDias + 1;

      if (diaFeira >= 1 && diaFeira <= diasFeiraCfg) {
        const dayConfig = diasConfig[diaFeira - 1];
        if (dayConfig && dayConfig.descricao) {
          descricaoDia = dayConfig.descricao;
        }
      }
    }

    // Count participants for this quiz
    const { count } = await admin
      .from('quiz_participantes')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_config_id', config.id);

    return NextResponse.json({
      id: config.id,
      quiz_ativo: config.quiz_ativo,
      nome_evento: nomeEvento,
      descricao_desafio: descricaoDia || config.descricao_desafio,
      mensagem_pausa: config.mensagem_pausa,
      total_participantes: count || 0,
      dia_feira: diaFeira,
      dias_feira: diasFeira,
      descricao_dia: descricaoDia,
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
    const { token, nome, empresa, telefone, palpite, email, cidade, cargo } = body;

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

    // Resolve dates from linked event if applicable
    let dataInicio = config.data_inicio;
    let diasFeiraCfg = config.dias_feira;
    let pipelineId = config.pipeline_id;
    const eventId: string | null = config.event_id || null;

    if (config.event_id) {
      const { data: event } = await admin
        .from('events')
        .select('start_date, end_date, pipeline_id')
        .eq('id', config.event_id)
        .single();

      if (event) {
        if (event.start_date) dataInicio = event.start_date;
        if (event.pipeline_id && !pipelineId) pipelineId = event.pipeline_id;
        if (event.start_date && event.end_date) {
          const start = new Date(event.start_date + 'T12:00:00');
          const end = new Date(event.end_date + 'T12:00:00');
          const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
          if (diffDays > 0) diasFeiraCfg = diffDays;
        }
      }
    }

    // Fallback: se nem o quiz nem o evento definiram pipeline, usa o primeiro da org.
    // Sem esse fallback o contato era silenciosamente descartado e sumia do CRM.
    if (!pipelineId) {
      const { data: firstPipeline } = await admin
        .from('pipelines')
        .select('id')
        .eq('organization_id', config.organization_id)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstPipeline) pipelineId = firstPipeline.id;
    }

    // Calculate current fair day
    let diaFeira: number | null = null;
    let valorExatoDia = config.valor_exato;
    const diasConfig: any[] = config.dias_config || [];

    // Quem controla abrir/fechar é o botão `quiz_ativo` acima. A data só serve
    // para escolher o gabarito do dia quando hoje cai dentro do range da feira;
    // fora do range, cai no valor_exato default e dia_feira fica null.
    if (dataInicio && diasFeiraCfg > 1) {
      const hoje = getTodaySP();
      const inicio = new Date(dataInicio + 'T00:00:00');
      const diffMs = hoje.getTime() - inicio.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diaCalc = diffDias + 1;

      if (diaCalc >= 1 && diaCalc <= diasFeiraCfg) {
        diaFeira = diaCalc;
        const dayConfig = diasConfig[diaCalc - 1];
        if (dayConfig && dayConfig.valor_exato != null) {
          valorExatoDia = dayConfig.valor_exato;
        }
      }
    }

    // Check for duplicate phone in this quiz (per day)
    const phoneNormalized = normalizePhone(telefone);
    if (phoneNormalized) {
      let dupQuery = admin
        .from('quiz_participantes')
        .select('id')
        .eq('quiz_config_id', config.id)
        .eq('telefone', phoneNormalized);

      if (diaFeira !== null) {
        dupQuery = dupQuery.eq('dia_feira', diaFeira);
      }

      const { data: existing } = await dupQuery.maybeSingle();

      if (existing) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: diaFeira !== null ? 'Você já participou hoje! Boa sorte!' : 'Você já participou deste quiz! Boa sorte!',
        });
      }
    }

    // VIP cheat: replace guess with exact value
    // Multi-day: use telefone_vip from dias_config[dia-1], single-day: use config.telefone_vip
    let palpiteFinal = Number(palpite);
    let telefoneVipDia: string | null = null;
    if (diaFeira !== null && diasConfig[diaFeira - 1]?.telefone_vip) {
      telefoneVipDia = diasConfig[diaFeira - 1].telefone_vip;
    } else if (config.telefone_vip) {
      telefoneVipDia = config.telefone_vip;
    }
    if (telefoneVipDia && phoneNormalized) {
      const vipNormalized = normalizePhone(telefoneVipDia);
      if (vipNormalized && phoneNormalized === vipNormalized) {
        palpiteFinal = valorExatoDia;
      }
    }

    let contactId: string | null = null;

    // Create contact in CRM (always, when pipeline is configured)
    // Wrapped in try/catch so participant is saved even if contact creation fails
    if (!pipelineId) {
      console.warn(`[quiz] No pipeline available for org ${config.organization_id} — contact will not be created.`);
    }
    if (pipelineId) {
      try {
        const { data: firstStage } = await admin
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', pipelineId)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!firstStage) {
          console.warn(`[quiz] Pipeline ${pipelineId} has no stages — contact will not be created.`);
        }

        if (firstStage) {
          // Check for duplicate contact by phone
          let existingContact: { id: string; event_id: string | null } | null = null;
          if (phoneNormalized) {
            const { data } = await admin
              .from('contacts')
              .select('id, event_id')
              .eq('organization_id', config.organization_id)
              .eq('phone_normalized', phoneNormalized)
              .maybeSingle();
            existingContact = data;
          }

          const emailTrim = typeof email === 'string' ? email.trim() : '';
          const emailNormalized = emailTrim ? normalizeEmail(emailTrim) : null;
          const cidadeTrim = typeof cidade === 'string' ? cidade.trim() : '';
          const cargoTrim = typeof cargo === 'string' ? cargo.trim() : '';

          if (existingContact) {
            contactId = existingContact.id;
            const patch: Record<string, any> = {};
            if (emailTrim) { patch.email = emailTrim; patch.email_normalized = emailNormalized; }
            if (cidadeTrim) patch.cidade = cidadeTrim;
            if (cargoTrim) patch.cargo = cargoTrim;
            if (eventId && !existingContact.event_id) patch.event_id = eventId;
            if (Object.keys(patch).length > 0) {
              await admin.from('contacts').update(patch).eq('id', existingContact.id);
            }
          } else {
            // Quiz é público (sem sessão), mas contacts.created_by_user_id é NOT NULL.
            // Creditamos o contato ao primeiro admin da org para a inserção passar.
            let createdByUserId: string | null = null;
            const { data: adminProfile } = await admin
              .from('profiles')
              .select('user_id')
              .eq('organization_id', config.organization_id)
              .eq('role', 'admin')
              .limit(1)
              .maybeSingle();
            createdByUserId = adminProfile?.user_id || null;
            if (!createdByUserId) {
              const { data: anyProfile } = await admin
                .from('profiles')
                .select('user_id')
                .eq('organization_id', config.organization_id)
                .limit(1)
                .maybeSingle();
              createdByUserId = anyProfile?.user_id || null;
            }

            const contactData: Record<string, any> = {
              organization_id: config.organization_id,
              name: nome.trim(),
              phone: telefone.trim(),
              phone_normalized: phoneNormalized,
              name_normalized: nome.trim().toLowerCase(),
              company: empresa.trim(),
              whatsapp: telefone.trim(),
              pipeline_id: pipelineId,
              stage_id: firstStage.id,
              tipo: [],
            };
            if (createdByUserId) contactData.created_by_user_id = createdByUserId;
            if (eventId) contactData.event_id = eventId;
            if (emailTrim) {
              contactData.email = emailTrim;
              contactData.email_normalized = emailNormalized;
            }
            if (cidadeTrim) contactData.cidade = cidadeTrim;
            if (cargoTrim) contactData.cargo = cargoTrim;

            const optionalFields: Record<string, any> = {
              origem: 'FEIRA',
              temperatura: 'MORNO',
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
                console.error('Contact insert retry also failed:', retryError.message);
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
    const insertData: Record<string, any> = {
      organization_id: config.organization_id,
      quiz_config_id: config.id,
      nome: nome.trim(),
      empresa: empresa.trim(),
      telefone: phoneNormalized || telefone.trim(),
      palpite: palpiteFinal,
      evento_nome: config.nome_evento,
      contact_id: contactId,
    };
    if (diaFeira !== null) {
      insertData.dia_feira = diaFeira;
    }

    const { data: participant, error: insertError } = await admin
      .from('quiz_participantes')
      .insert(insertData)
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
