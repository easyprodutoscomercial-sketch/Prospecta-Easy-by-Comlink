import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/contacts/:id/custom-fields
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('contact_custom_field_values')
      .select('*')
      .eq('contact_id', contactId);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/contacts/:id/custom-fields
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Perfil nao encontrado' }, { status: 403 });

    const body = await request.json();
    const { values } = body; // Array of { field_id, value_text?, value_number?, value_date?, value_boolean? }

    if (!Array.isArray(values)) {
      return NextResponse.json({ error: 'values deve ser um array' }, { status: 400 });
    }

    const admin = getAdminClient();

    for (const val of values) {
      if (!val.field_id) continue;

      const record = {
        organization_id: profile.organization_id,
        contact_id: contactId,
        field_id: val.field_id,
        value_text: val.value_text ?? null,
        value_number: val.value_number ?? null,
        value_date: val.value_date ?? null,
        value_boolean: val.value_boolean ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await admin
        .from('contact_custom_field_values')
        .upsert(record, { onConflict: 'contact_id,field_id' });

      if (error) {
        console.error('Error upserting custom field value:', error);
      }
    }

    const { data: updated } = await admin
      .from('contact_custom_field_values')
      .select('*')
      .eq('contact_id', contactId);

    return NextResponse.json(updated || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
