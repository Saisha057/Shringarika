#!/usr/bin/env node

/**
 * DATABASE CLEANUP SCRIPT
 * 
 * Purpose: Delete ALL products from Supabase database
 * Use Case: Clear test data before production deployment
 * 
 * Usage: node server/scripts/clear-products.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for admin operations

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearAllProducts() {
  try {
    console.log('🗑️  Starting database cleanup...');
    console.log('📡 Connected to:', supabaseUrl);
    
    // Count products before deletion
    const { count: beforeCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw countError;
    }
    
    console.log(`📊 Found ${beforeCount} products in database`);
    
    if (beforeCount === 0) {
      console.log('✅ Database is already clean - no products to delete');
      return;
    }
    
    // Confirm deletion
    console.log('⚠️  WARNING: This will permanently delete ALL products!');
    console.log('⏳ Proceeding with deletion in 3 seconds...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Delete all products
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows (this condition is always true for valid UUIDs)
    
    if (deleteError) {
      throw deleteError;
    }
    
    // Verify deletion
    const { count: afterCount, error: verifyError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    if (verifyError) {
      throw verifyError;
    }
    
    console.log('✅ Database cleanup complete!');
    console.log(`📊 Products deleted: ${beforeCount}`);
    console.log(`📊 Remaining products: ${afterCount}`);
    
    if (afterCount === 0) {
      console.log('🎉 Database is now clean - ready for fresh data!');
    } else {
      console.warn('⚠️  Some products may not have been deleted');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Run cleanup
clearAllProducts()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
