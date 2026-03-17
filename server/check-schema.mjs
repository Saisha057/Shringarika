import dotenv from 'dotenv';
import { initializeSupabase, getSupabaseAdmin } from './config/supabase.js';

dotenv.config();
initializeSupabase();
const supabase = getSupabaseAdmin();

const { data, error } = await supabase
  .from('products')
  .select('*')
  .limit(1);

if (data && data[0]) {
  console.log('✅ Products table columns:');
  console.log(Object.keys(data[0]).sort().join('\n'));
} else {
  console.log('❌ Error or no data:', error);
}
