import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://edwkdrgferjbitxwlwrf.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkd2tkcmdmZXJqYml0eHdsd3JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcxMjA3OSwiZXhwIjoyMDg2Mjg4MDc5fQ.KILRshoC8XLuoJyx9Xrlz_Ve8-W9LOxYtsvWndyXfdc';

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('Testing if position_x / position_y columns exist on event_booths...');

  const { error } = await supabase
    .from('event_booths')
    .select('position_x, position_y')
    .limit(1);

  if (error && (error.message.includes('position_x') || error.message.includes('position_y'))) {
    console.log('Columns do not exist. Please run this SQL in Supabase Dashboard > SQL Editor:');
    console.log('');
    console.log('  ALTER TABLE event_booths');
    console.log('    ADD COLUMN IF NOT EXISTS position_x NUMERIC,');
    console.log('    ADD COLUMN IF NOT EXISTS position_y NUMERIC;');
    console.log('');
    console.log('Go to: https://supabase.com/dashboard/project/edwkdrgferjbitxwlwrf/sql/new');
  } else if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Columns already exist! No migration needed.');
  }
}

main();
