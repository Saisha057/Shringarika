import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { initializeSupabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function checkSchema() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 CHECKING PRODUCT_VARIANTS TABLE SCHEMA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const { supabaseAdmin } = initializeSupabase();
    
    // Try to query with minimal columns
    console.log('1️⃣ Trying basic query...');
    const { data: basicData, error: basicError } = await supabaseAdmin
      .from('product_variants')
      .select('*')
      .limit(1);

    if (basicError) {
      console.log('   ❌ Error:', basicError.message);
      console.log('   Code:', basicError.code);
    } else {
      console.log('   ✅ Query successful');
      if (basicData && basicData.length > 0) {
        console.log('   📋 Available columns:', Object.keys(basicData[0]));
        console.log('   📄 Sample data:', basicData[0]);
      } else {
        console.log('   📪 Table is empty');
      }
    }

    // Try to insert a simple variant without color
    console.log('\n2️⃣ Testing insert without color field...');
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, price')
      .limit(1);

    if (products && products.length > 0) {
      const product = products[0];
      console.log(`   Testing with product: ${product.name}`);

      const testVariant = {
        product_id: product.id,
        sku: `TEST-SKU-${Date.now()}`,
        size: 'M',
        stock_quantity: 10,
        price: product.price,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('product_variants')
        .insert([testVariant])
        .select();

      if (insertError) {
        console.log('   ❌ Error:', insertError.message);
        console.log('   Code:', insertError.code);
        
        // Try with even fewer fields
        console.log('\n3️⃣ Testing with minimal fields...');
        const minimalVariant = {
          product_id: product.id,
          sku: `MINIMAL-${Date.now()}`,
          price: product.price
        };

        const { data: minimalData, error: minimalError } = await supabaseAdmin
          .from('product_variants')
          .insert([minimalVariant])
          .select();

        if (minimalError) {
          console.log('   ❌ Error:', minimalError.message);
        } else {
          console.log('   ✅ Success with minimal fields!');
          console.log('   📋 Inserted variant:', minimalData[0]);
          
          // Clean up test variant
          await supabaseAdmin
            .from('product_variants')
            .delete()
            .eq('id', minimalData[0].id);
          console.log('   🧹 Cleaned up test variant');
        }
      } else {
        console.log('   ✅ Insert successful!');
        console.log('   📋 Inserted variant:', insertData[0]);
        
        // Clean up
        await supabaseAdmin
          .from('product_variants')
          .delete()
          .eq('id', insertData[0].id);
        console.log('   🧹 Cleaned up test variant');
      }
    }

  } catch (err) {
    console.error('❌ Fatal error:', err);
  }
}

checkSchema().catch(console.error);
