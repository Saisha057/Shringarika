#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProductImages() {
  console.log('\n📸 Checking Product Images in Database...\n');

  try {
    // Get all products
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, images')
      .limit(5);

    if (error) {
      console.error('❌ Error fetching products:', error.message);
      return;
    }

    if (!products || products.length === 0) {
      console.log('⚠️  No products found in database');
      return;
    }

    console.log(`Found ${products.length} products:\n`);

    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (ID: ${product.id})`);
      console.log(`   Images:`, product.images);
      
      if (product.images && Array.isArray(product.images)) {
        product.images.forEach((img, imgIndex) => {
          console.log(`   [${imgIndex}] Type: ${typeof img}`);
          
          if (typeof img === 'string') {
            // Check if it's a URL
            if (img.startsWith('http://') || img.startsWith('https://')) {
              console.log(`       ✅ Valid HTTP URL (${img.length} chars)`);
              console.log(`       URL: ${img.substring(0, 100)}${img.length > 100 ? '...' : ''}`);
            } 
            // Check if it's a data URI
            else if (img.startsWith('data:')) {
              console.log(`       ⚠️  Data URI detected (${img.length} chars)`);
              console.log(`       Preview: ${img.substring(0, 50)}...`);
            }
            // Check if it's a relative path
            else if (img.startsWith('/')) {
              console.log(`       ℹ️  Relative path: ${img}`);
            }
            else {
              console.log(`       ❓ Unknown format: ${img.substring(0, 50)}${img.length > 50 ? '...' : ''}`);
            }
          } else {
            console.log(`       ❌ Invalid type: ${typeof img}`);
          }
        });
      } else {
        console.log(`   ❌ Images is not an array or is null`);
      }
      console.log('');
    });

    console.log('\n📊 Summary:');
    const allImages = products.flatMap(p => p.images || []);
    const dataUris = allImages.filter(img => typeof img === 'string' && img.startsWith('data:'));
    const httpUrls = allImages.filter(img => typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://')));
    const relativePaths = allImages.filter(img => typeof img === 'string' && img.startsWith('/') && !img.startsWith('//'));
    const unknown = allImages.filter(img => {
      if (typeof img !== 'string') return true;
      return !img.startsWith('data:') && !img.startsWith('http://') && !img.startsWith('https://') && !img.startsWith('/');
    });

    console.log(`Total images: ${allImages.length}`);
    console.log(`Data URIs: ${dataUris.length} ${dataUris.length > 0 ? '⚠️' : ''}`);
    console.log(`HTTP URLs: ${httpUrls.length} ${httpUrls.length > 0 ? '✅' : ''}`);
    console.log(`Relative paths: ${relativePaths.length}`);
    console.log(`Unknown/Invalid: ${unknown.length} ${unknown.length > 0 ? '❌' : ''}`);

    if (dataUris.length > 0) {
      console.log('\n⚠️  WARNING: Data URIs detected!');
      console.log('   Data URIs (base64 images) may cause ERR_INVALID_URL errors in browsers.');
      console.log('   Consider uploading images to Cloudinary or another CDN and storing URLs instead.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProductImages();
