import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeContactData, normalizePhone, normalizeCPF, normalizeCNPJ, normalizeEmail } from '@/lib/utils/normalize';
import { ImportResult } from '@/lib/types';
import { ensureProfile } from '@/lib/ensure-profile';

const MAX_ROWS = 2000;

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome', phone: 'Telefone', email: 'Email', cpf: 'CPF', cnpj: 'CNPJ',
  company: 'Empresa', notes: 'Observações', tipo: 'Tipo', referencia: 'Referência',
  classe: 'Classe', produtos_fornecidos: 'Produtos Fornecidos', contato_nome: 'Contato',
  cargo: 'Cargo', endereco: 'Endereço', cidade: 'Cidade', estado: 'Estado', cep: 'CEP',
  website: 'Website', instagram: 'Instagram', whatsapp: 'WhatsApp',
};

function formatRowAsNotes(row: Record<string, any>, rowNumber: number): string {
  const date = new Date().toLocaleDateString('pt-BR');
  const lines = [`[Importação ${date} - Linha ${rowNumber}]`];
  for (const [key, value] of Object.entries(row)) {
    if (value && String(value).trim()) {
      const label = FIELD_LABELS[key] || key;
      const val = Array.isArray(value) ? value.join(', ') : String(value).trim();
      lines.push(`${label}: ${val}`);
    }
  }
  return lines.join('\n');
}

// Fields that can be merged from import into existing contact (only if existing is empty/null)
const MERGEABLE_FIELDS = [
  'phone', 'email', 'cpf', 'cnpj', 'company', 'notes',
  'tipo', 'referencia', 'classe', 'produtos_fornecidos',
  'contato_nome', 'cargo', 'endereco', 'cidade', 'estado', 'cep',
  'website', 'instagram', 'whatsapp',
] as const;

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
    const { rows, mode = 'skip', pipeline_id } = body; // mode: 'skip' | 'update' | 'overwrite'

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha para importar' }, { status: 400 });
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Limite de ${MAX_ROWS} linhas excedido` },
        { status: 400 }
      );
    }

    // Fetch target pipeline and its first stage so imported contacts appear in kanban
    let defaultPipelineId: string | null = null;
    let firstStageId: string | null = null;

    if (pipeline_id) {
      // Validate that the provided pipeline belongs to this organization
      const { data: targetPipeline } = await admin
        .from('pipelines')
        .select('id')
        .eq('id', pipeline_id)
        .eq('organization_id', profile.organization_id)
        .single();

      if (targetPipeline) {
        defaultPipelineId = targetPipeline.id;
        const { data: firstStage } = await admin
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', targetPipeline.id)
          .order('position', { ascending: true })
          .limit(1)
          .single();

        if (firstStage) {
          firstStageId = firstStage.id;
        }
      }
    }

    // Fallback to org default pipeline if no pipeline_id provided or validation failed
    if (!defaultPipelineId) {
      const { data: defaultPipeline } = await admin
        .from('pipelines')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (defaultPipeline) {
        defaultPipelineId = defaultPipeline.id;
        const { data: firstStage } = await admin
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', defaultPipeline.id)
          .order('position', { ascending: true })
          .limit(1)
          .single();

        if (firstStage) {
          firstStageId = firstStage.id;
        }
      }
    }

    // Pre-fetch existing contacts for batch duplicate check (more efficient)
    const { data: existingContacts } = await admin
      .from('contacts')
      .select('id, name, email, phone, cpf, cnpj, company, notes, email_normalized, phone_normalized, cpf_digits, cnpj_digits, tipo, referencia, classe, produtos_fornecidos, contato_nome, cargo, endereco, cidade, estado, cep, website, instagram, whatsapp, pipeline_id, stage_id')
      .eq('organization_id', profile.organization_id);

    // Build lookup maps from existing contacts (using both raw and normalized fields)
    // Maps store normalized value -> contact object for quick lookup
    const emailToContact = new Map<string, any>();
    const phoneToContact = new Map<string, any>();
    const cpfToContact = new Map<string, any>();
    const cnpjToContact = new Map<string, any>();

    // Also keep sets for quick existence checks
    const existingEmails = new Set<string>();
    const existingPhones = new Set<string>();
    const existingCpfs = new Set<string>();
    const existingCnpjs = new Set<string>();

    for (const c of existingContacts || []) {
      const email = c.email_normalized || normalizeEmail(c.email);
      const phone = c.phone_normalized || normalizePhone(c.phone);
      const cpf = c.cpf_digits || normalizeCPF(c.cpf);
      const cnpj = c.cnpj_digits || normalizeCNPJ(c.cnpj);
      if (email) { existingEmails.add(email); emailToContact.set(email, c); }
      if (phone) { existingPhones.add(phone); phoneToContact.set(phone, c); }
      if (cpf) { existingCpfs.add(cpf); cpfToContact.set(cpf, c); }
      if (cnpj) { existingCnpjs.add(cnpj); cnpjToContact.set(cnpj, c); }
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
      updated_count: 0,
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
        let existingContact: any = null;
        let isBatchDuplicate = false;

        // 1) CPF (highest priority)
        if (normalized.cpf_digits) {
          if (existingCpfs.has(normalized.cpf_digits)) {
            isDuplicate = true;
            duplicateReason = `CPF ${row.cpf} já existe`;
            existingContact = cpfToContact.get(normalized.cpf_digits);
          } else if (batchCpfs.has(normalized.cpf_digits)) {
            isDuplicate = true;
            isBatchDuplicate = true;
            duplicateReason = `CPF ${row.cpf} duplicado na planilha`;
          }
        }

        // 2) CNPJ
        if (!isDuplicate && normalized.cnpj_digits) {
          if (existingCnpjs.has(normalized.cnpj_digits)) {
            isDuplicate = true;
            duplicateReason = `CNPJ ${row.cnpj} já existe`;
            existingContact = cnpjToContact.get(normalized.cnpj_digits);
          } else if (batchCnpjs.has(normalized.cnpj_digits)) {
            isDuplicate = true;
            isBatchDuplicate = true;
            duplicateReason = `CNPJ ${row.cnpj} duplicado na planilha`;
          }
        }

        // 3) Telefone
        if (!isDuplicate && normalized.phone_normalized) {
          if (existingPhones.has(normalized.phone_normalized)) {
            isDuplicate = true;
            duplicateReason = `Telefone ${row.phone} já existe`;
            existingContact = phoneToContact.get(normalized.phone_normalized);
          } else if (batchPhones.has(normalized.phone_normalized)) {
            isDuplicate = true;
            isBatchDuplicate = true;
            duplicateReason = `Telefone ${row.phone} duplicado na planilha`;
          }
        }

        // 4) Email
        if (!isDuplicate && normalized.email_normalized) {
          if (existingEmails.has(normalized.email_normalized)) {
            isDuplicate = true;
            duplicateReason = `Email ${row.email} já existe`;
            existingContact = emailToContact.get(normalized.email_normalized);
          } else if (batchEmails.has(normalized.email_normalized)) {
            isDuplicate = true;
            isBatchDuplicate = true;
            duplicateReason = `Email ${row.email} duplicado na planilha`;
          }
        }

        if (isDuplicate) {
          // Mode "update": merge new data into existing contact (only fill empty fields)
          // Mode "overwrite": force update all fields from spreadsheet
          if ((mode === 'update' || mode === 'overwrite') && existingContact && !isBatchDuplicate) {
            const updateData: Record<string, any> = {};
            let fieldsUpdated: string[] = [];
            const isOverwrite = mode === 'overwrite';

            for (const field of MERGEABLE_FIELDS) {
              const newValue = normalized[field as keyof typeof normalized];
              const existingValue = existingContact[field];

              // Special handling for arrays (tipo)
              if (field === 'tipo') {
                const existingTipo = existingValue as string[] || [];
                const newTipo = newValue as string[] || [];
                if (newTipo.length > 0) {
                  if (isOverwrite) {
                    updateData.tipo = newTipo;
                    fieldsUpdated.push('tipo');
                  } else {
                    // Merge: add new types that don't exist yet
                    const merged = [...new Set([...existingTipo, ...newTipo])];
                    if (merged.length > existingTipo.length) {
                      updateData.tipo = merged;
                      fieldsUpdated.push('tipo');
                    }
                  }
                }
                continue;
              }

              // For notes: append instead of replace (in update mode), replace in overwrite
              if (field === 'notes') {
                if (newValue && typeof newValue === 'string' && newValue.trim()) {
                  if (isOverwrite) {
                    updateData.notes = newValue;
                    fieldsUpdated.push('notes');
                  } else if (existingValue && typeof existingValue === 'string' && existingValue.trim()) {
                    // Append new notes
                    updateData.notes = `${existingValue}\n---\n${newValue}`;
                    fieldsUpdated.push('notes');
                  } else {
                    updateData.notes = newValue;
                    fieldsUpdated.push('notes');
                  }
                }
                continue;
              }

              if (isOverwrite) {
                // Overwrite: replace field if new value exists
                if (newValue) {
                  updateData[field] = newValue;
                  fieldsUpdated.push(field);
                }
              } else {
                // Update: only fill if existing is empty/null and new value exists
                if ((!existingValue || (typeof existingValue === 'string' && existingValue.trim() === '')) && newValue) {
                  updateData[field] = newValue;
                  fieldsUpdated.push(field);
                }
              }
            }

            // Also update normalized fields if identity fields were added
            if (updateData.email) updateData.email_normalized = normalized.email_normalized;
            if (updateData.phone) updateData.phone_normalized = normalized.phone_normalized;
            if (updateData.cpf) updateData.cpf_digits = normalized.cpf_digits;
            if (updateData.cnpj) updateData.cnpj_digits = normalized.cnpj_digits;

            // Assign pipeline/stage if contact doesn't have one yet
            if (!existingContact.pipeline_id && defaultPipelineId) {
              updateData.pipeline_id = defaultPipelineId;
              if (firstStageId) updateData.stage_id = firstStageId;
            }

            if (Object.keys(updateData).length > 0) {
              // Perform update
              const { error: updateError } = await admin
                .from('contacts')
                .update(updateData)
                .eq('id', existingContact.id);

              if (updateError) {
                result.invalid_count++;
                result.items.push({
                  row_number: rowNumber,
                  status: 'invalid',
                  error_message: `Erro ao atualizar: ${updateError.message}`,
                  data: row,
                });
                continue;
              }

              // Update the in-memory contact data so subsequent rows see updated values
              Object.assign(existingContact, updateData);

              // Update lookup maps if new identity fields were added
              if (updateData.email_normalized) {
                existingEmails.add(updateData.email_normalized);
                emailToContact.set(updateData.email_normalized, existingContact);
              }
              if (updateData.phone_normalized) {
                existingPhones.add(updateData.phone_normalized);
                phoneToContact.set(updateData.phone_normalized, existingContact);
              }
              if (updateData.cpf_digits) {
                existingCpfs.add(updateData.cpf_digits);
                cpfToContact.set(updateData.cpf_digits, existingContact);
              }
              if (updateData.cnpj_digits) {
                existingCnpjs.add(updateData.cnpj_digits);
                cnpjToContact.set(updateData.cnpj_digits, existingContact);
              }

              result.updated_count++;
              result.items.push({
                row_number: rowNumber,
                status: 'updated',
                contact_id: existingContact.id,
                error_message: `Atualizado: ${fieldsUpdated.join(', ')}`,
                data: row,
              });
            } else {
              // Nothing to update via fields - but still append row data to notes
              const notesEntry = formatRowAsNotes(row, rowNumber);
              const existingNotes = existingContact.notes || '';
              const newNotes = existingNotes
                ? `${existingNotes}\n---\n${notesEntry}`
                : notesEntry;

              const notesUpdateData: Record<string, any> = { notes: newNotes };
              if (!existingContact.pipeline_id && defaultPipelineId) {
                notesUpdateData.pipeline_id = defaultPipelineId;
                if (firstStageId) notesUpdateData.stage_id = firstStageId;
              }

              const { error: notesError } = await admin
                .from('contacts')
                .update(notesUpdateData)
                .eq('id', existingContact.id);

              if (!notesError) {
                existingContact.notes = newNotes;
                if (notesUpdateData.pipeline_id) existingContact.pipeline_id = notesUpdateData.pipeline_id;
                if (notesUpdateData.stage_id) existingContact.stage_id = notesUpdateData.stage_id;
              }

              result.updated_count++;
              result.items.push({
                row_number: rowNumber,
                status: 'updated',
                contact_id: existingContact.id,
                error_message: `${duplicateReason} — dados salvos em observações`,
                data: row,
              });
            }
          } else {
            // Mode "skip": append row data to notes of existing contact
            if (existingContact && !isBatchDuplicate) {
              const notesEntry = formatRowAsNotes(row, rowNumber);
              const existingNotes = existingContact.notes || '';
              const newNotes = existingNotes
                ? `${existingNotes}\n---\n${notesEntry}`
                : notesEntry;

              const skipUpdateData: Record<string, any> = { notes: newNotes };
              if (!existingContact.pipeline_id && defaultPipelineId) {
                skipUpdateData.pipeline_id = defaultPipelineId;
                if (firstStageId) skipUpdateData.stage_id = firstStageId;
              }

              const { error: notesError } = await admin
                .from('contacts')
                .update(skipUpdateData)
                .eq('id', existingContact.id);

              if (!notesError) {
                existingContact.notes = newNotes;
                if (skipUpdateData.pipeline_id) existingContact.pipeline_id = skipUpdateData.pipeline_id;
                if (skipUpdateData.stage_id) existingContact.stage_id = skipUpdateData.stage_id;
              }
            }

            result.duplicate_count++;
            result.items.push({
              row_number: rowNumber,
              status: 'duplicate',
              contact_id: existingContact?.id || undefined,
              error_message: `${duplicateReason}${existingContact && !isBatchDuplicate ? ' — dados salvos em observações' : ''}`,
              data: row,
            });
          }
        } else {
          // Criar contato
          const { data: newContact, error } = await admin
            .from('contacts')
            .insert({
              organization_id: profile.organization_id,
              ...normalized,
              created_by_user_id: user.id,
              ...(defaultPipelineId ? { pipeline_id: defaultPipelineId } : {}),
              ...(firstStageId ? { stage_id: firstStageId } : {}),
            })
            .select()
            .single();

          if (error) throw error;

          // Add to batch tracking sets so next rows detect duplicates within batch
          if (normalized.email_normalized) {
            batchEmails.add(normalized.email_normalized);
            existingEmails.add(normalized.email_normalized);
            emailToContact.set(normalized.email_normalized, newContact);
          }
          if (normalized.phone_normalized) {
            batchPhones.add(normalized.phone_normalized);
            existingPhones.add(normalized.phone_normalized);
            phoneToContact.set(normalized.phone_normalized, newContact);
          }
          if (normalized.cpf_digits) {
            batchCpfs.add(normalized.cpf_digits);
            existingCpfs.add(normalized.cpf_digits);
            cpfToContact.set(normalized.cpf_digits, newContact);
          }
          if (normalized.cnpj_digits) {
            batchCnpjs.add(normalized.cnpj_digits);
            existingCnpjs.add(normalized.cnpj_digits);
            cnpjToContact.set(normalized.cnpj_digits, newContact);
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
        updated_count: result.updated_count,
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
