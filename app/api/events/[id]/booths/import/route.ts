import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import * as XLSX from 'xlsx';

// POST /api/events/[id]/booths/import
// Aceita CSV ou XLSX com os campos: company_name (obrigatório), booth_number, sector
// Dedupe por (company_name + booth_number) dentro do evento.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();

    // Verifica se o evento pertence à org
    const { data: event } = await admin
      .from('events')
      .select('id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Tenta parsear como XLSX (xlsx lib também lê CSV)
    let rows: any[] = [];
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return NextResponse.json({ error: 'Arquivo vazio' }, { status: 400 });
      }
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch (e: any) {
      return NextResponse.json({ error: `Erro ao ler arquivo: ${e.message}` }, { status: 400 });
    }

    if (!rows.length) {
      return NextResponse.json({ error: 'Nenhuma linha encontrada no arquivo' }, { status: 400 });
    }

    // Normaliza nomes das colunas (case-insensitive, remove espaços/acentos)
    const normalize = (s: string) =>
      s.toString().toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

    // Possíveis nomes de coluna (pt + en)
    const companyKeys = ['companyname', 'company', 'empresa', 'expositor', 'nome', 'razaosocial'];
    const boothKeys = ['boothnumber', 'booth', 'stand', 'numero', 'numerostand', 'standnumber', 'numerodostand'];
    const sectorKeys = ['sector', 'setor', 'area', 'categoria', 'pavilhao', 'ala'];

    const pickField = (row: any, candidates: string[]): string => {
      for (const key of Object.keys(row)) {
        const norm = normalize(key);
        if (candidates.includes(norm)) {
          const v = row[key];
          if (v === null || v === undefined) return '';
          return String(v).trim();
        }
      }
      return '';
    };

    // Carrega stands existentes do evento (pra dedupe)
    const { data: existing } = await admin
      .from('event_booths')
      .select('company_name, booth_number')
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id);

    const existingKeys = new Set(
      (existing || []).map((e: any) =>
        `${normalize(e.company_name || '')}|${normalize(e.booth_number || '')}`
      )
    );

    let created = 0;
    let skipped = 0;
    let errors = 0;
    const toInsert: any[] = [];
    const seenInBatch = new Set<string>();
    // Amostra das linhas rejeitadas pra mostrar feedback ao usuário (máximo 20)
    const MAX_REJECTED_SAMPLE = 20;
    const rejectedSample: Array<{ row_number: number; reason: string; preview: string }> = [];

    const addRejected = (rowNumber: number, reason: string, row: any) => {
      if (rejectedSample.length >= MAX_REJECTED_SAMPLE) return;
      const preview = Object.entries(row)
        .filter(([_, v]) => v !== '' && v !== null && v !== undefined)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
        .join(' | ');
      rejectedSample.push({ row_number: rowNumber, reason, preview: preview || '(vazia)' });
    };

    rows.forEach((row, idx) => {
      const rowNumber = idx + 2; // +2 porque linha 1 é header, e humanos contam a partir de 1
      const company_name = pickField(row, companyKeys);
      if (!company_name) {
        errors++;
        addRejected(rowNumber, 'Sem nome da empresa', row);
        return;
      }
      const booth_number = pickField(row, boothKeys) || null;
      const sector = pickField(row, sectorKeys) || null;

      const dedupeKey = `${normalize(company_name)}|${normalize(booth_number || '')}`;
      if (existingKeys.has(dedupeKey)) {
        skipped++;
        addRejected(rowNumber, 'Já cadastrado no evento', row);
        return;
      }
      if (seenInBatch.has(dedupeKey)) {
        skipped++;
        addRejected(rowNumber, 'Duplicado dentro da mesma planilha', row);
        return;
      }
      seenInBatch.add(dedupeKey);

      toInsert.push({
        event_id: id,
        organization_id: profile.organization_id,
        company_name,
        booth_number,
        sector,
        status: 'PENDENTE',
      });
    });

    if (toInsert.length > 0) {
      // Insere em batches de 100
      const BATCH = 100;
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const chunk = toInsert.slice(i, i + BATCH);
        const { error } = await admin.from('event_booths').insert(chunk);
        if (error) {
          errors += chunk.length;
          addRejected(0, `Erro do banco: ${error.message.slice(0, 100)}`, {});
        } else {
          created += chunk.length;
        }
      }
    }

    return NextResponse.json({
      created,
      skipped,
      errors,
      total_rows: rows.length,
      rejected_sample: rejectedSample,
      rejected_total: errors + skipped,
    });
  } catch (error: any) {
    console.error('[booths/import] error:', error);
    return NextResponse.json({ error: error.message || 'Erro no import' }, { status: 500 });
  }
}
