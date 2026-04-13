import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://edwkdrgferjbitxwlwrf.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkd2tkcmdmZXJqYml0eHdsd3JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcxMjA3OSwiZXhwIjoyMDg2Mjg4MDc5fQ.KILRshoC8XLuoJyx9Xrlz_Ve8-W9LOxYtsvWndyXfdc';

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('Testing if cover_image_url column exists...');

  // Try to select the column
  const { data, error } = await supabase
    .from('events')
    .select('cover_image_url')
    .limit(1);

  if (error && error.message.includes('cover_image_url')) {
    console.log('Column does not exist. Please run this SQL in Supabase Dashboard > SQL Editor:');
    console.log('');
    console.log('  ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image_url TEXT;');
    console.log('');
    console.log('Go to: https://supabase.com/dashboard/project/edwkdrgferjbitxwlwrf/sql/new');
  } else if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Column already exists! No migration needed.');
  }
}

main();
