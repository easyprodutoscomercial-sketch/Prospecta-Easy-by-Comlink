import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import * as XLSX from 'xlsx';

// GET /api/events/[id]/export-contacts
// Exporta todos os contatos criados/ligados a este evento como Excel (.xlsx).
// Usa contacts.event_id primeiramente, e também cruza com booth_visits.contact_id
// pra garantir que pegamos contatos ligados via check-in.
export async function GET(
  _request: NextRequest,
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

    // Valida que o evento existe na org e pega o nome pra usar no filename
    const { data: event } = await admin
      .from('events')
      .select('id, name')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    // 1. Contatos com event_id apontando pra este evento
    const { data: directContacts } = await admin
      .from('contacts')
      .select('id, name, company, email, phone, whatsapp, cargo, contato_nome, cidade, estado, cpf, cnpj, tipo, origem, temperatura, notes, created_at')
      .eq('organization_id', profile.organization_id)
      .eq('event_id', id);

    // 2. Contatos ligados via booth_visits.contact_id
    const { data: visits } = await admin
      .from('booth_visits')
      .select('contact_id, contact_name, prospect_type, visited_at, event_booths(company_name, booth_number, sector)')
      .eq('organization_id', profile.organization_id)
      .eq('event_id', id);

    const visitContactIds = Array.from(
      new Set((visits || []).map((v: any) => v.contact_id).filter(Boolean))
    );

    let visitContacts: any[] = [];
    if (visitContactIds.length > 0) {
      const { data } = await admin
        .from('contacts')
        .select('id, name, company, email, phone, whatsapp, cargo, contato_nome, cidade, estado, cpf, cnpj, tipo, origem, temperatura, notes, created_at')
        .eq('organization_id', profile.organization_id)
        .in('id', visitContactIds);
      visitContacts = data || [];
    }

    // Merge por id (evita duplicata), com map pra buscar info do visit
    const byId = new Map<string, any>();
    (directContacts || []).forEach((c: any) => byId.set(c.id, c));
    visitContacts.forEach((c: any) => {
      if (!byId.has(c.id)) byId.set(c.id, c);
    });

    // Info do booth_visit por contact_id (último visit)
    const visitByContactId = new Map<string, any>();
    (visits || []).forEach((v: any) => {
      if (v.contact_id && !visitByContactId.has(v.contact_id)) {
        visitByContactId.set(v.contact_id, v);
      }
    });

    const allContacts = Array.from(byId.values());

    // Monta linhas pra planilha
    const xlsRows = allContacts.map((c) => {
      const visit = visitByContactId.get(c.id);
      const booth = visit?.event_booths;
      // Tipo de captura: Stand se tem booth_visit, Avulso se so tem event_id.
      // Fallback por marker [Avulso] nas notes pra ser ainda mais robusto.
      const captureType = visit
        ? 'Stand'
        : (c.notes || '').startsWith('[Avulso]')
          ? 'Avulso'
          : 'Evento';
      return {
        'Tipo de Captura': captureType,
        'Nome': c.name || '',
        'Empresa': c.company || booth?.company_name || '',
        'Email': c.email || '',
        'Telefone': c.phone || '',
        'WhatsApp': c.whatsapp || '',
        'Cargo': c.cargo || '',
        'Contato Primário': c.contato_nome || '',
        'Cidade': c.cidade || '',
        'Estado': c.estado || '',
        'CPF': c.cpf || '',
        'CNPJ': c.cnpj || '',
        'Tipo': (c.tipo || []).join(', '),
        'Origem': c.origem || '',
        'Temperatura': c.temperatura || '',
        'Prospecção (visita)': visit?.prospect_type || '',
        'Stand (número)': booth?.booth_number || '',
        'Setor do Stand': booth?.sector || '',
        'Data da visita': visit?.visited_at
          ? new Date(visit.visited_at).toLocaleString('pt-BR')
          : '',
        'Observações': c.notes || '',
        'Criado em': c.created_at ? new Date(c.created_at).toLocaleString('pt-BR') : '',
      };
    });

    // Cria workbook XLSX
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(xlsRows);

    // Auto-width das colunas (heurística: max entre header e valores, capado)
    if (xlsRows.length > 0) {
      const headers = Object.keys(xlsRows[0]);
      ws['!cols'] = headers.map((h) => {
        const maxLen = Math.max(
          h.length,
          ...xlsRows.map((r) => String(r[h as keyof typeof r] || '').length),
        );
        return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
      });
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    // Sanitiza nome do evento pro filename
    const safeName = (event.name || 'evento')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 60);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `leads_${safeName}_${date}.xlsx`;

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error: any) {
    console.error('[events/export-contacts] error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao exportar' }, { status: 500 });
  }
}
