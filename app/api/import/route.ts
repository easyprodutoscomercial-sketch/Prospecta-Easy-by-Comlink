import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeContactData } from '@/lib/utils/normalize';
import { ImportResult } from '@/lib/types';
import { ensureProfile } from '@/lib/ensure-profile';

const MAX_ROWS = 2000;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);

    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();
    const body = await request.json();
    const { rows } = body; // Array de objetos {name, phone, email, cpf, cnpj, company, notes}

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha para importar' }, { status: 400 });
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Limite de ${MAX_ROWS} linhas excedido` },
        { status: 400 }
      );
    }

    // Criar import_run
    const { data: importRun, error: runError } = await admin
      .from('import_runs')
      .insert({
        organization_id: profile.organization_id,
        created_by_user_id: user.id,
        total_rows: rows.length,
      })
      .select()
      .single();

    if (runError) throw runError;

    const result: ImportResult = {
      total_rows: rows.length,
      created_count: 0,
      duplicate_count: 0,
      invalid_count: 0,
      items: [],
    };

    // Processar cada linha
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      try {
        // Validar campos obrigatórios
        if (!row.name || row.name.trim() === '') {
          result.invalid_count++;
          result.items.push({
            row_number: rowNumber,
            status: 'invalid',
            error_message: 'Nome é obrigatório',
            data: row,
          });
          continue;
        }

        // Parse tipo from CSV (comma-separated in a single field)
        let tipo: string[] = [];
        if (row.tipo) {
          tipo = row.tipo.split(',').map((t: string) => t.trim().toUpperCase()).filter((t: string) => ['FORNECEDOR', 'COMPRADOR'].includes(t));
        }

        // Sanitizar classe (só aceita A, B, C, D ou null)
        const classeRaw = row.classe ? String(row.classe).trim().toUpperCase() : null;
        const classeValid = classeRaw && ['A', 'B', 'C', 'D'].includes(classeRaw) ? classeRaw : null;

        // Normalizar
        const normalized = normalizeContactData({
          name: row.name,
          phone: row.phone,
          email: row.email,
          cpf: row.cpf,
          cnpj: row.cnpj,
          company: row.company,
          notes: row.notes,
          tipo,
          referencia: row.referencia,
          classe: classeValid,
          produtos_fornecidos: row.produtos_fornecidos,
          contato_nome: row.contato_nome,
          cargo: row.cargo,
          endereco: row.endereco,
          cidade: row.cidade,
          estado: row.estado,
          cep: row.cep,
          website: row.website,
          instagram: row.instagram,
          whatsapp: row.whatsapp,
        });

        // Verificar duplicidade
        let isDuplicate = false;
        let duplicateId = null;

        // Checar por email
        if (normalized.email_normalized) {
          const { data } = await admin
            .from('contacts')
            .select('id')
            .eq('organization_id', profile.organization_id)
            .eq('email_normalized', normalized.email_normalized)
            .limit(1)
            .maybeSingle();

          if (data) {
            isDuplicate = true;
            duplicateId = data.id;
          }
        }

        // Checar por telefone
        if (!isDuplicate && normalized.phone_normalized) {
          const { data } = await admin
            .from('contacts')
            .select('id')
            .eq('organization_id', profile.organization_id)
            .eq('phone_normalized', normalized.phone_normalized)
            .limit(1)
            .maybeSingle();

          if (data) {
            isDuplicate = true;
            duplicateId = data.id;
          }
        }

        // Checar por CPF
        if (!isDuplicate && normalized.cpf_digits) {
          const { data } = await admin
            .from('contacts')
            .select('id')
            .eq('organization_id', profile.organization_id)
            .eq('cpf_digits', normalized.cpf_digits)
            .limit(1)
            .maybeSingle();

          if (data) {
            isDuplicate = true;
            duplicateId = data.id;
          }
        }

        // Checar por CNPJ
        if (!isDuplicate && normalized.cnpj_digits) {
          const { data } = await admin
            .from('contacts')
            .select('id')
            .eq('organization_id', profile.organization_id)
            .eq('cnpj_digits', normalized.cnpj_digits)
            .limit(1)
            .maybeSingle();

          if (data) {
            isDuplicate = true;
            duplicateId = data.id;
          }
        }

        if (isDuplicate) {
          result.duplicate_count++;
          result.items.push({
            row_number: rowNumber,
            status: 'duplicate',
            contact_id: duplicateId!,
            data: row,
          });
        } else {
          // Criar contato (sem responsável — só via "Apontar")
          const { data: newContact, error } = await admin
            .from('contacts')
            .insert({
              organization_id: profile.organization_id,
              ...normalized,
              created_by_user_id: user.id,
            })
            .select()
            .single();

          if (error) throw error;

          result.created_count++;
          result.items.push({
            row_number: rowNumber,
            status: 'created',
            contact_id: newContact.id,
            data: row,
          });
        }

      } catch (error: any) {
        result.invalid_count++;
        result.items.push({
          row_number: rowNumber,
          status: 'invalid',
          error_message: error.message,
          data: row,
        });
      }
    }

    // Atualizar import_run com resultados
    await admin
      .from('import_runs')
      .update({
        created_count: result.created_count,
        duplicate_count: result.duplicate_count,
        invalid_count: result.invalid_count,
      })
      .eq('id', importRun.id);

    // Salvar items (opcional, para histórico)
    const importItems = result.items.map(item => ({
      import_run_id: importRun.id,
      row_number: item.row_number,
      status: item.status,
      contact_id: item.contact_id || null,
      error_message: item.error_message || null,
      data: item.data,
    }));

    if (importItems.length > 0) {
      await admin.from('import_run_items').insert(importItems);
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error importing contacts:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao importar contatos' },
      { status: 500 }
    );
  }
}
