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
      .select('id, quiz_ativo, nome_evento, descricao_desafio, mensagem_pausa, token_publico, data_inicio, dias_feira, dias_config')
      .eq('token_publico', token)
      .single();

    if (error || !config) {
      return NextResponse.json({ error: 'Quiz não encontrado' }, { status: 404 });
    }

    // Calculate current fair day
    let diaFeira: number | null = null;
    let diasFeira: number | null = null;
    let descricaoDia: string | null = null;
    const diasConfig: any[] = config.dias_config || [];

    if (config.data_inicio && config.dias_feira > 1) {
      diasFeira = config.dias_feira;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const inicio = new Date(config.data_inicio + 'T00:00:00');
      const diffMs = hoje.getTime() - inicio.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      diaFeira = diffDias + 1;

      if (diaFeira >= 1 && diaFeira <= config.dias_feira) {
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
      nome_evento: config.nome_evento,
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

    // Calculate current fair day
    let diaFeira: number | null = null;
    let valorExatoDia = config.valor_exato;
    const diasConfig: any[] = config.dias_config || [];

    if (config.data_inicio && config.dias_feira > 1) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const inicio = new Date(config.data_inicio + 'T00:00:00');
      const diffMs = hoje.getTime() - inicio.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      diaFeira = diffDias + 1;

      if (diaFeira < 1 || diaFeira > config.dias_feira) {
        return NextResponse.json({ error: 'O quiz não está aberto hoje.' }, { status: 410 });
      }

      // Get valor_exato for this day
      const dayConfig = diasConfig[diaFeira - 1];
      if (dayConfig && dayConfig.valor_exato) {
        valorExatoDia = dayConfig.valor_exato;
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
