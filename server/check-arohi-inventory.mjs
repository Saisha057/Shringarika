import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);

// Find AROHI COLLECTION
const { data: products, error } = await s.from('products').select('id,name,sizes,colors').ilike('name','%AROHI%');
if (error) { console.error('Error:', error.message); process.exit(1); }
console.log('AROHI products found:', products?.length);
products?.forEach(p => console.log(`  - ${p.name} (${p.id}) | sizes: ${JSON.stringify(p.sizes)} | colors: ${JSON.stringify(p.colors)}`));

for (const p of products || []) {
  const { data: inv } = await s.from('product_inventory').select('id,size,color,stock,is_active').eq('product_id', p.id);
  console.log(`\nInventory for "${p.name}" (${inv?.length} rows):`);
  inv?.forEach(r => console.log(`  - size: ${r.size} | color: ${JSON.stringify(r.color)} | stock: ${r.stock} | active: ${r.is_active}`));
}

// Also check what the RPC returns for size S
if (products?.[0]) {
  const { data: check, error: ce } = await s.rpc('check_stock_availability', {
    p_product_id: products[0].id,
    p_size: 'S',
    p_color: 'default',
    p_quantity: 1
  });
  console.log('\nRPC check_stock_availability (S, default):', JSON.stringify(check));
  if (ce) console.error('RPC error:', ce.message);

  // Also try with null color
  const { data: check2, error: ce2 } = await s.rpc('check_stock_availability', {
    p_product_id: products[0].id,
    p_size: 'S',
    p_color: null,
    p_quantity: 1
  });
  console.log('RPC check_stock_availability (S, null):', JSON.stringify(check2));
  if (ce2) console.error('RPC error:', ce2.message);
}
