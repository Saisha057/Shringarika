/**
 * Seed product_inventory for all products that are missing inventory entries.
 * Run this once to fix existing products: node seed-missing-inventory.mjs
 */
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🌱 Seeding product inventory for products missing it...\n');

// Get all products
const { data: products, error: prodErr } = await supabase
  .from('products')
  .select('id, name, sizes, specifications, is_active')
  .eq('is_active', true);

if (prodErr) {
  console.error('Failed to fetch products:', prodErr.message);
  process.exit(1);
}

console.log(`Found ${products.length} active products\n`);

for (const product of products) {
  // Get existing inventory entries for this product
  const { data: existingInv } = await supabase
    .from('product_inventory')
    .select('size')
    .eq('product_id', product.id);

  const existingSizes = new Set((existingInv || []).map(e => e.size));

  // Determine what sizes this product needs
  const productSizes = product.sizes?.length > 0
    ? product.sizes
    : (product.specifications?.sizes?.length > 0 ? product.specifications.sizes : ['S', 'M', 'L', 'XL']);

  const missingSizes = productSizes.filter(s => !existingSizes.has(s));

  if (missingSizes.length === 0) {
    console.log(`  ✅ ${product.name}: inventory OK (${existingSizes.size} entries)`);
    continue;
  }

  console.log(`  ⚠️  ${product.name}: missing inventory for sizes [${missingSizes.join(', ')}]`);

  // Create inventory entries for missing sizes
  const entriesToInsert = missingSizes.map(size => ({
    product_id: product.id,
    size: size,
    color: null,
    stock: 50,      // Default starting stock
    is_active: true,
    reserved_quantity: 0,
    reserved_stock: 0,
    low_stock_threshold: 5,
    auto_generated: true,
  }));

  const { error: insertErr } = await supabase
    .from('product_inventory')
    .insert(entriesToInsert);

  if (insertErr) {
    console.error(`  ❌ Failed to seed inventory for ${product.name}:`, insertErr.message);
  } else {
    console.log(`  ✅ Created ${entriesToInsert.length} inventory entries for ${product.name}`);
  }
}

// Also update product total_stock
console.log('\n📊 Updating product total_stock values...');
const { data: allProducts } = await supabase.from('products').select('id, name');
for (const p of (allProducts || [])) {
  const { data: inv } = await supabase
    .from('product_inventory')
    .select('stock')
    .eq('product_id', p.id)
    .eq('is_active', true);
  
  const totalStock = (inv || []).reduce((sum, i) => sum + (i.stock || 0), 0);
  await supabase.from('products').update({
    total_stock: totalStock,
    in_stock: totalStock > 0,
    stock_updated_at: new Date().toISOString()
  }).eq('id', p.id);
}
console.log('✅ Product total_stock values updated\n');

console.log('🌱 Inventory seeding complete!');
