import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);

// AROHI COLLECTION with colors:["red"] but inventory has color:"Red"
const productId = 'bec196d0-4890-4763-a7bb-53ae5c6f7dad';
const fromFrontend = 'red'; // what frontend sends (lowercase from product.colors[0])

// OLD approach: .eq('color', 'red') → does NOT match 'Red' in DB
const {data: oldResult} = await s.from('product_inventory')
  .select('id,size,color,stock')
  .eq('product_id', productId)
  .eq('size', 'S')
  .eq('color', fromFrontend)
  .eq('is_active', true)
  .limit(1);
console.log('OLD eq() match for color="red":', oldResult?.length, 'rows -', oldResult?.[0] ? JSON.stringify(oldResult[0]) : '(NONE - this was the bug!)');

// NEW approach: .ilike('color', 'red') → MATCHES 'Red' case-insensitively
const {data: newResult} = await s.from('product_inventory')
  .select('id,size,color,stock')
  .eq('product_id', productId)
  .eq('size', 'S')
  .ilike('color', fromFrontend)
  .eq('is_active', true)
  .limit(1);
console.log('NEW ilike() match for color="red":', newResult?.length, 'rows -', newResult?.[0] ? JSON.stringify(newResult[0]) : '(none)');

// Also test empty color (product.colors[0] was empty or not there)
const productId2 = 'c8fd27ae-3640-42c2-8188-3c2f8b8ad645';
const {data: noColorResult} = await s.from('product_inventory')
  .select('id,size,color,stock')
  .eq('product_id', productId2)
  .eq('size', 'S')
  .eq('is_active', true)
  .limit(1);
console.log('\nNo-color query (size S any color):', noColorResult?.length, 'rows - first:', noColorResult?.[0] ? JSON.stringify(noColorResult[0]) : '(none)');

console.log('\n✅ If NEW ilike shows a row and OLD eq shows (NONE) -- the fix is confirmed!');
