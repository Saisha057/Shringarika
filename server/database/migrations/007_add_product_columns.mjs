import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://srdljxbumxkgjxoqqrzs.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZGxqeGJ1bXhrZ2p4b3FxcnpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM2OTczMCwiZXhwIjoyMDgwOTQ1NzMwfQ.MAFZq4GAApGTOUBaPYqXv-Pjg4cVw1HO9CnWPvj-Jt0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Running migration to add product columns...');

  // SQL to add all needed columns
  const alterStatements = [
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_type VARCHAR(100)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[]",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT[]", 
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT[]",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS color VARCHAR(100)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS material VARCHAR(255)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS wash_care TEXT[]",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS label VARCHAR(50)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 4.5",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews INTEGER DEFAULT 0",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT true"
  ];

  for (const sql of alterStatements) {
    try {
      // Execute raw SQL via supabase
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        // Column might already exist, try another approach
        console.log('⚠️ RPC failed, trying direct insert test:', error.message);
      } else {
        console.log('✅', sql.substring(0, 60) + '...');
      }
    } catch (e) {
      console.log('⚠️ Error:', e.message);
    }
  }

  // Test by inserting a product with all fields
  console.log('\n📝 Testing product insert with all fields...');
  
  const testProduct = {
    name: 'Test Product Migration',
    slug: 'test-product-migration-' + Date.now(),
    price: 999,
    category: 'SAREES',
    sub_type: 'Silk Sarees',
    description: 'Test product description',
    images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: ['Red', 'Blue', 'Green'],
    color: 'Red',
    material: 'Silk',
    wash_care: ['Dry clean only', 'Do not bleach'],
    label: 'NEW',
    rating: 4.5,
    reviews: 0,
    in_stock: true
  };

  const { data, error } = await supabase
    .from('products')
    .insert([testProduct])
    .select();

  if (error) {
    console.error('❌ Insert failed:', error.message);
    console.log('\n⚠️ The columns may not exist. Please run this SQL in Supabase SQL Editor:\n');
    console.log(`
-- Add missing columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_type VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS color VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS material VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS wash_care TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS label VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 4.5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT true;
    `);
  } else {
    console.log('✅ Product inserted successfully!');
    console.log('Product ID:', data[0].id);
    console.log('Columns available:', Object.keys(data[0]).join(', '));
    
    // Clean up test product
    await supabase.from('products').delete().eq('id', data[0].id);
    console.log('🧹 Test product cleaned up');
  }
}

runMigration();
