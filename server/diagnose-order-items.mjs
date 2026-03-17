import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseOrderItems() {
  console.log('\n🔍 DIAGNOSING ORDER_ITEMS TABLE...\n');

  try {
    // Try to get one order_item to see what columns exist
    const { data: items, error } = await supabase
      .from('order_items')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error fetching order_items:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      return;
    }

    if (!items || items.length === 0) {
      console.log('⚠️  No order_items found in database');
      console.log('   This means no orders have been placed with items yet.');
      return;
    }

    console.log('✅ order_items table exists!');
    console.log('\n📋 ACTUAL COLUMNS IN DATABASE:');
    console.log('─'.repeat(70));
    const columns = Object.keys(items[0]);
    columns.forEach((col, idx) => {
      console.log(`   ${idx + 1}. ${col}`);
    });
    console.log('─'.repeat(70));

    // Check for price-related columns specifically
    console.log('\n💰 PRICE COLUMN ANALYSIS:');
    const priceColumns = columns.filter(c => c.toLowerCase().includes('price'));
    if (priceColumns.length > 0) {
      priceColumns.forEach(col => {
        console.log(`   ✅ Found: ${col} = ${items[0][col]}`);
      });
    } else {
      console.log('   ❌ NO PRICE COLUMNS FOUND!');
    }

    // Check what the backend expects
    console.log('\n🔧 BACKEND EXPECTS:');
    console.log('   - price_per_item (from Order.model.js line 27)');
    
    console.log('\n🗄️  DATABASE HAS:');
    if (columns.includes('price_per_item')) {
      console.log('   ✅ price_per_item EXISTS');
    } else if (columns.includes('unit_price')) {
      console.log('   ❌ unit_price (MISMATCH!)');
      console.log('   📝 FIX NEEDED: Backend queries price_per_item but DB has unit_price');
    } else if (columns.includes('price')) {
      console.log('   ❌ price (MISMATCH!)');
      console.log('   📝 FIX NEEDED: Backend queries price_per_item but DB has price');
    } else {
      console.log('   ❌ NO PRICE COLUMN AT ALL!');
    }

    console.log('\n📊 SAMPLE RECORD:');
    console.log(JSON.stringify(items[0], null, 2));

    // Now test the exact query the backend uses
    console.log('\n🧪 TESTING BACKEND QUERY...');
    console.log('   Query: .select(`order_items (id, product_id, variant_id, quantity, price_per_item)`)');
    
    const { data: testData, error: testError } = await supabase
      .from('orders')
      .select(`
        id,
        order_items (
          id,
          product_id,
          variant_id,
          quantity,
          price_per_item
        )
      `)
      .limit(1);

    if (testError) {
      console.log('   ❌ QUERY FAILED!');
      console.log('   Error:', testError.message);
      console.log('   Code:', testError.code);
      
      // Try with unit_price instead
      console.log('\n🧪 TESTING WITH unit_price...');
      const { data: testData2, error: testError2 } = await supabase
        .from('orders')
        .select(`
          id,
          order_items (
            id,
            product_id,
            variant_id,
            quantity,
            unit_price
          )
        `)
        .limit(1);
      
      if (testError2) {
        console.log('   ❌ ALSO FAILED with unit_price!');
        console.log('   Error:', testError2.message);
      } else {
        console.log('   ✅ SUCCESS with unit_price!');
        console.log('   📝 FIX: Change price_per_item to unit_price in backend');
      }
    } else {
      console.log('   ✅ Query succeeded with price_per_item');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }

  console.log('\n');
}

diagnoseOrderItems();
