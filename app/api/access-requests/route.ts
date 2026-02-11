import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { accessRequestSchema } from '@/lib/utils/validation';

// GET /api/access-requests?role=owner|requester
export async function GET(request: NextRequest) {
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
    const role = request.nextUrl.searchParams.get('role') || 'owner';

    const { data: requests, error } = await admin
      .from('access_requests')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq(role === 'owner' ? 'owner_user_id' : 'requester_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Join with profiles and contacts for names
    const enriched = await Promise.all(
      (requests || []).map(async (req: any) => {
        const [requesterRes, ownerRes, contactRes] = await Promise.all([
          admin.from('profiles').select('name, email').eq('user_id', req.requester_user_id).single(),
          admin.from('profiles').select('name, email').eq('user_id', req.owner_user_id).single(),
          admin.from('contacts').select('name').eq('id', req.contact_id).single(),
        ]);

        return {
          ...req,
          requester_name: requesterRes.data?.name || '',
          requester_email: requesterRes.data?.email || '',
          owner_name: ownerRes.data?.name || '',
          owner_email: ownerRes.data?.email || '',
          contact_name: contactRes.data?.name || '',
        };
      })
    );

    return NextResponse.json({ requests: enriched });
  } catch (error: any) {
    console.error('Error listing access requests:', error);
    return NextResponse.json({ error: error.message || 'Erro ao listar solicitações' }, { status: 500 });
  }
}

// POST /api/access-requests - Criar solicitação
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
    const validated = accessRequestSchema.parse(body);

    // Buscar contato para verificar dono
    const { data: contact } = await admin
      .from('contacts')
      .select('assigned_to_user_id, organization_id')
      .eq('id', validated.contact_id)
      .single();

    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    if (!contact.assigned_to_user_id) {
      return NextResponse.json({ error: 'Contato não tem responsável atribuído' }, { status: 400 });
    }

    if (contact.assigned_to_user_id === user.id) {
      return NextResponse.json({ error: 'Você já é o responsável deste contato' }, { status: 400 });
    }

    // Verificar se já existe solicitação pendente
    const { data: existing } = await admin
      .from('access_requests')
      .select('id')
      .eq('contact_id', validated.contact_id)
      .eq('requester_user_id', user.id)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Já existe uma solicitação pendente para este contato' }, { status: 409 });
    }

    const { data: newRequest, error } = await admin
      .from('access_requests')
      .insert({
        organization_id: profile.organization_id,
        contact_id: validated.contact_id,
        requester_user_id: user.id,
        owner_user_id: contact.assigned_to_user_id,
        status: 'PENDING',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error: any) {
    console.error('Error creating access request:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'Erro ao criar solicitação' }, { status: 500 });
  }
}
