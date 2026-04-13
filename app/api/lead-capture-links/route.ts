import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import crypto from 'crypto';

function generateToken(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

// GET /api/lead-capture-links - Lista links do usuario logado
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();

    const { data: links, error } = await admin
      .from('lead_capture_links')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Buscar nomes dos pipelines
    const pipelineIds = [...new Set((links || []).map((l: any) => l.pipeline_id))];
    let pipelineNames: Record<string, string> = {};

    if (pipelineIds.length > 0) {
      const { data: pipelines } = await admin
        .from('pipelines')
        .select('id, name')
        .in('id', pipelineIds);

      pipelineNames = Object.fromEntries(
        (pipelines || []).map((p: any) => [p.id, p.name])
      );
    }

    // Buscar nomes dos eventos (so dos links que tem event_id)
    const eventIds = [...new Set((links || []).map((l: any) => l.event_id).filter(Boolean))];
    let eventNames: Record<string, string> = {};
    if (eventIds.length > 0) {
      const { data: events } = await admin
        .from('events')
        .select('id, name')
        .in('id', eventIds);
      eventNames = Object.fromEntries(
        (events || []).map((e: any) => [e.id, e.name])
      );
    }

    const linksWithPipelineName = (links || []).map((l: any) => ({
      ...l,
      pipeline_name: pipelineNames[l.pipeline_id] || 'Pipeline removido',
      event_name: l.event_id ? (eventNames[l.event_id] || null) : null,
    }));

    return NextResponse.json({ links: linksWithPipelineName });
  } catch (error: any) {
    console.error('Error listing lead capture links:', error);
    return NextResponse.json({ error: error.message || 'Erro ao listar links' }, { status: 500 });
  }
}

// POST /api/lead-capture-links - Criar novo link
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();
    const body = await request.json();

    const { pipeline_id, label, whatsapp_vendedor, event_id } = body;

    if (!pipeline_id) {
      return NextResponse.json({ error: 'pipeline_id e obrigatorio' }, { status: 400 });
    }

    // Verificar se o pipeline existe e pertence a org
    const { data: pipeline, error: pipError } = await admin
      .from('pipelines')
      .select('id, name')
      .eq('id', pipeline_id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (pipError || !pipeline) {
      return NextResponse.json({ error: 'Pipeline nao encontrado' }, { status: 404 });
    }

    // event_id e opcional — se informado, valida que pertence a org e que o
    // pipeline do evento bate com o pipeline do link (senao e pegadinha).
    let validEventId: string | null = null;
    let eventName: string | null = null;
    if (event_id) {
      const { data: event, error: evError } = await admin
        .from('events')
        .select('id, name, pipeline_id')
        .eq('id', event_id)
        .eq('organization_id', profile.organization_id)
        .single();
      if (evError || !event) {
        return NextResponse.json({ error: 'Evento nao encontrado' }, { status: 404 });
      }
      if (event.pipeline_id && event.pipeline_id !== pipeline_id) {
        return NextResponse.json({
          error: 'Pipeline do link deve ser o mesmo do evento',
        }, { status: 400 });
      }
      validEventId = event.id;
      eventName = event.name;
    }

    // Gerar token unico
    let token = generateToken();
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await admin
        .from('lead_capture_links')
        .select('id')
        .eq('token', token)
        .maybeSingle();

      if (!existing) break;
      token = generateToken();
      attempts++;
    }

    const { data: link, error } = await admin
      .from('lead_capture_links')
      .insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        pipeline_id,
        event_id: validEventId,
        token,
        label: label || null,
        whatsapp_vendedor: whatsapp_vendedor?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      ...link,
      pipeline_name: pipeline.name,
      event_name: eventName,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating lead capture link:', error);
    return NextResponse.json({ error: error.message || 'Erro ao criar link' }, { status: 500 });
  }
}
