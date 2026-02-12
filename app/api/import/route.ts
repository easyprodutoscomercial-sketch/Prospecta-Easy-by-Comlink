import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeContactData, normalizePhone, normalizeCPF, normalizeCNPJ, normalizeEmail } from '@/lib/utils/normalize';
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
    const { rows } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha para importar' }, { status: 400 });
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Limite de ${MAX_ROWS} linhas excedido` },
        { status: 400 }
      );
    }

    // Pre-fetch existing contacts for batch duplicate check (more efficient)
    const { data: existingContacts } = await admin
      .from('contacts')
      .select('id, email, phone, cpf, cnpj, email_normalized, phone_normalized, cpf_digits, cnpj_digits')
      .eq('organization_id', profile.organization_id);

    // Build lookup sets from existing contacts (using both raw and normalized fields)
    const existingEmails = new Set<string>();
    const existingPhones = new Set<string>();
    const existingCpfs = new Set<string>();
    const existingCnpjs = new Set<string>();

    for (const c of existingContacts || []) {
      const email = c.email_normalized || normalizeEmail(c.email);
      const phone = c.phone_normalized || normalizePhone(c.phone);
      const cpf = c.cpf_digits || normalizeCPF(c.cpf);
      const cnpj = c.cnpj_digits || normalizeCNPJ(c.cnpj);
      if (email) existingEmails.add(email);
      if (phone) existingPhones.add(phone);
      if (cpf) existingCpfs.add(cpf);
      if (cnpj) existingCnpjs.add(cnpj);
    }

    // Track within-batch duplicates
    const batchEmails = new Set<string>();
    const batchPhones = new Set<string>();
    const batchCpfs = new Set<string>();
    const batchCnpjs = new Set<string>();

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

        // Check duplicates against EXISTING contacts + within-batch
        let isDuplicate = false;
        let duplicateReason = '';

        // 1) CPF (highest priority)
        if (normalized.cpf_digits) {
          if (existingCpfs.has(normalized.cpf_digits)) {
            isDuplicate = true;
            duplicateReason = `CPF ${row.cpf} já existe`;
          } else if (batchCpfs.has(normalized.cpf_digits)) {
            isDuplicate = true;
            duplicateReason = `CPF ${row.cpf} duplicado na planilha`;
          }
        }

        // 2) CNPJ
        if (!isDuplicate && normalized.cnpj_digits) {
          if (existingCnpjs.has(normalized.cnpj_digits)) {
            isDuplicate = true;
            duplicateReason = `CNPJ ${row.cnpj} já existe`;
          } else if (batchCnpjs.has(normalized.cnpj_digits)) {
            isDuplicate = true;
            duplicateReason = `CNPJ ${row.cnpj} duplicado na planilha`;
          }
        }

        // 3) Telefone
        if (!isDuplicate && normalized.phone_normalized) {
          if (existingPhones.has(normalized.phone_normalized)) {
            isDuplicate = true;
            duplicateReason = `Telefone ${row.phone} já existe`;
          } else if (batchPhones.has(normalized.phone_normalized)) {
            isDuplicate = true;
            duplicateReason = `Telefone ${row.phone} duplicado na planilha`;
          }
        }

        // 4) Email
        if (!isDuplicate && normalized.email_normalized) {
          if (existingEmails.has(normalized.email_normalized)) {
            isDuplicate = true;
            duplicateReason = `Email ${row.email} já existe`;
          } else if (batchEmails.has(normalized.email_normalized)) {
            isDuplicate = true;
            duplicateReason = `Email ${row.email} duplicado na planilha`;
          }
        }

        if (isDuplicate) {
          result.duplicate_count++;
          result.items.push({
            row_number: rowNumber,
            status: 'duplicate',
            error_message: duplicateReason,
            data: row,
          });
        } else {
          // Criar contato
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

          // Add to batch tracking sets so next rows detect duplicates within batch
          if (normalized.email_normalized) {
            batchEmails.add(normalized.email_normalized);
            existingEmails.add(normalized.email_normalized);
          }
          if (normalized.phone_normalized) {
            batchPhones.add(normalized.phone_normalized);
            existingPhones.add(normalized.phone_normalized);
          }
          if (normalized.cpf_digits) {
            batchCpfs.add(normalized.cpf_digits);
            existingCpfs.add(normalized.cpf_digits);
          }
          if (normalized.cnpj_digits) {
            batchCnpjs.add(normalized.cnpj_digits);
            existingCnpjs.add(normalized.cnpj_digits);
          }

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

    // Salvar items
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
