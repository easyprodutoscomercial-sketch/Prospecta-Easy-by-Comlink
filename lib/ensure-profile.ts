import { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';

export async function ensureProfile(supabase: SupabaseClient, user: { id: string; email?: string; user_metadata?: any }): Promise<{ user_id: string; organization_id: string; name: string; email: string } | null> {
  const admin = getAdminClient();

  const { data: profile, error: fetchError } = await admin
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching profile:', fetchError.message);
    return null;
  }

  if (profile) return profile;

  // Auto-create organization + profile
  const orgName = user.email?.split('@')[0] || 'Minha Empresa';

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: orgName })
    .select()
    .single();

  if (orgError) {
    console.error('Error creating organization:', orgError.message);
    return null;
  }

  const { data: newProfile, error: profileError } = await admin
    .from('profiles')
    .insert({
      user_id: user.id,
      organization_id: org.id,
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
      email: user.email || '',
    })
    .select()
    .single();

  if (profileError) {
    console.error('Error creating profile:', profileError.message);
    return null;
  }

  return newProfile;
}
