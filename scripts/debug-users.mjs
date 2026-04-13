import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://edwkdrgferjbitxwlwrf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // Get ACAER contact to find the org and user
  const { data } = await supabase
    .from('contacts')
    .select('id, name, created_by_user_id, organization_id, referencia')
    .eq('email_normalized', 'acaer@bol.com.br')
    .single();
  console.log('ACAER:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
