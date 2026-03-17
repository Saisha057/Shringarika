import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { initializeSupabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function listAllTables() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 LISTING ALL TABLES IN DATABASE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const { supabaseAdmin } = initializeSupabase();
    
    // Try both table names
    const tablesToTest = [
      'product_variants',
      'product_inventory',
      'products',
      'orders',
      'order_items'
    ];

    for (const table of tablesToTest) {
      console.log(`🔍 Testing table: ${table}`);
      
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Exists - ${count} rows`);
        
        // If table exists and is empty, try to get schema
        const { data, error: dataError } = await supabaseAdmin
          .from(table)
          .select('*')
          .limit(1);

        if (!dataError && data && data.length > 0) {
          console.log(`   📋 Columns: ${Object.keys(data[0]).join(', ')}`);
        }
      }
      console.log('');
    }

  } catch (err) {
    console.error('❌ Fatal error:', err);
  }
}

listAllTables().catch(console.error);
