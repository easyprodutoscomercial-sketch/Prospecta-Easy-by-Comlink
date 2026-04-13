import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// POST /api/events/[id]/booths/[boothId]/qr-link
// Fetches existing lead_capture_links for the event's pipeline + current user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; boothId: string }> }
) {
  try {
    const { id: eventId, boothId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();

    // Verify event exists, belongs to org, and has a pipeline
    const { data: event } = await admin
      .from('events')
      .select('id, name, pipeline_id')
      .eq('id', eventId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Evento nao encontrado' }, { status: 404 });
    }

    if (!event.pipeline_id) {
      return NextResponse.json({ error: 'Evento precisa ter um pipeline configurado para usar QR Code' }, { status: 400 });
    }

    // Verify booth exists and belongs to this event
    const { data: booth } = await admin
      .from('event_booths')
      .select('id, company_name, booth_number')
      .eq('id', boothId)
      .eq('event_id', eventId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!booth) {
      return NextResponse.json({ error: 'Stand nao encontrado' }, { status: 404 });
    }

    // Fetch active lead_capture_links for this user + pipeline.
    // Prioriza links ja amarrados a este evento (event_id bate). Se nao houver,
    // cai nos links genericos (event_id null) do mesmo pipeline.
    const { data: allLinks, error: linksError } = await admin
      .from('lead_capture_links')
      .select('id, token, label, pipeline_id, whatsapp_vendedor, event_id')
      .eq('user_id', user.id)
      .eq('pipeline_id', event.pipeline_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (linksError) throw linksError;

    const linksForThisEvent = (allLinks || []).filter((l: any) => l.event_id === eventId);
    const genericLinks = (allLinks || []).filter((l: any) => l.event_id === null);
    const links = linksForThisEvent.length > 0 ? linksForThisEvent : genericLinks;

    if (!links || links.length === 0) {
      return NextResponse.json({
        error: 'Nenhum QR Code encontrado para este pipeline. Crie um link de captura no menu "QR Codes" primeiro.',
      }, { status: 404 });
    }

    const baseUrl = request.nextUrl.origin;

    // Return all links so user can pick, with first as default
    const linksWithUrl = links.map((l: any) => ({
      id: l.id,
      token: l.token,
      label: l.label,
      event_scoped: l.event_id === eventId,
      url: `${baseUrl}/lead-capture/${l.token}?event=${eventId}&booth=${boothId}`,
    }));

    return NextResponse.json({
      links: linksWithUrl,
      event_name: event.name,
      booth_company: booth.company_name,
      booth_number: booth.booth_number,
    });
  } catch (error: any) {
    console.error('Error fetching QR links:', error);
    return NextResponse.json({ error: error.message || 'Erro ao buscar links QR' }, { status: 500 });
  }
}
