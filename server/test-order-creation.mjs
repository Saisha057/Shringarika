import axios from 'axios';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const API_URL = 'http://localhost:5000/api';
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 ORDER CREATION DIAGNOSTIC TEST');
console.log('=' .repeat(50));
console.log('');

async function runTests() {
  // TEST 1: Check if backend is running
  console.log('📡 TEST 1: Backend health check...');
  try {
    const healthResponse = await axios.get('http://localhost:5000/health');
    console.log('✅ Backend is running:', healthResponse.data);
  } catch (error) {
    console.error('❌ Backend not responding:', error.message);
    process.exit(1);
  }
  console.log('');

  // TEST 2: Get a real user from database
  console.log('📊 TEST 2: Fetching test user from database...');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, role')
    .limit(1);

  if (usersError || !users || users.length === 0) {
    console.error('❌ No users found in database:', usersError?.message);
    console.log('💡 Creating a test user...');
    
    const testUser = {
      email: 'test-order@example.com',
      password_hash: '$2a$10$dummyhashfortest',
      name: 'Test User',
      role: 'user',
      phone: '9999999999'
    };
    
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([testUser])
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Failed to create test user:', createError.message);
      process.exit(1);
    }
    
    users[0] = newUser;
    console.log('✅ Test user created:', newUser.email);
  } else {
    console.log('✅ Found user:', users[0].email, '| ID:', users[0].id, '| Role:', users[0].role);
  }
  
  const testUser = users[0];
  console.log('');

  // TEST 3: Generate JWT token
  console.log('🔑 TEST 3: Generating JWT token...');
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET not found in .env file!');
    process.exit(1);
  }
  
  const token = jwt.sign(
    { 
      id: testUser.id,
      email: testUser.email,
      role: testUser.role
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  
  console.log('✅ JWT token generated');
  console.log('   First 20 chars:', token.substring(0, 20) + '...');
  console.log('');

  // TEST 4: Verify token can be decoded
  console.log('🔐 TEST 4: Verifying token...');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token verified successfully');
    console.log('   User ID:', decoded.id);
    console.log('   Email:', decoded.email);
    console.log('   Role:', decoded.role);
  } catch (verifyError) {
    console.error('❌ Token verification failed:', verifyError.message);
    process.exit(1);
  }
  console.log('');

  // TEST 5: Test protected endpoint WITHOUT token
  console.log('🚫 TEST 5: Testing /api/orders without auth (should get 401)...');
  try {
    const noAuthResponse = await axios.get(`${API_URL}/orders`);
    console.log('❌ UNEXPECTED: Got response without auth:', noAuthResponse.status);
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Correctly received 401 Unauthorized');
      console.log('   Message:', error.response?.data?.message);
    } else {
      console.log('⚠️  Unexpected error:', error.response?.status, error.response?.data?.message);
    }
  }
  console.log('');

  // TEST 6: Test protected endpoint WITH token
  console.log('🔑 TEST 6: Testing /api/orders with valid token...');
  try {
    const authResponse = await axios.get(`${API_URL}/orders`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('✅ Successfully authenticated!');
    console.log('   Status:', authResponse.status);
    console.log('   Response:', JSON.stringify(authResponse.data, null, 2).substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ Auth request failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data?.message);
    console.error('   Full error:', error.response?.data);
  }
  console.log('');

  // TEST 7: Get products for order creation
  console.log('📦 TEST 7: Fetching products...');
  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price')
      .limit(1);

    if (productsError || !products || products.length === 0) {
      console.error('❌ No products found:', productsError?.message);
      console.log('⚠️  Cannot test order creation without products');
      return;
    }

    const testProduct = products[0];
    console.log('✅ Found product:', testProduct.name, '| Price: ₹' + testProduct.price);
    console.log('');

    // TEST 8: Get product variant
    console.log('🎨 TEST 8: Fetching product variant...');
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', testProduct.id)
      .limit(1);

    if (variantsError || !variants || variants.length === 0) {
      console.log('⚠️  No variants found for product:', testProduct.name);
      console.log('   This is OK - variant_id is now nullable');
    } else {
      console.log('✅ Found variant:', variants[0].size, variants[0].color, '| Stock:', variants[0].stock_quantity);
    }
    console.log('');

    // TEST 9: Create order WITH authentication
    console.log('🛒 TEST 9: Creating order WITH authentication...');
    const orderData = {
      orderItems: [{
        product: testProduct.id,
        name: testProduct.name,
        quantity: 1,
        price: testProduct.price,
        size: variants?.[0]?.size || 'M',
        color: variants?.[0]?.color || 'Red'
      }],
      shippingAddress: {
        fullName: 'Test User',
        doorNo: '123',
        street: 'Test Street',
        city: 'Test City',
        state: 'Test State',
        pinCode: '123456',
        email: testUser.email,
        phone: '9999999999'
      },
      contactDetails: {
        name: 'Test User',
        email: testUser.email,
        phone: '9999999999'
      },
      paymentMethod: 'COD',
      itemsPrice: testProduct.price,
      taxPrice: 0,
      shippingPrice: 0,
      discount: 0,
      totalPrice: testProduct.price
    };

    console.log('📤 Sending order data...');
    console.log('   Product:', testProduct.name);
    console.log('   Quantity: 1');
    console.log('   Total: ₹' + testProduct.price);

    try {
      const orderResponse = await axios.post(`${API_URL}/orders`, orderData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('');
      console.log('✅ ORDER CREATED SUCCESSFULLY!');
      console.log('   Status:', orderResponse.status);
      console.log('   Order ID:', orderResponse.data?.data?.order?.id);
      console.log('   Order Number:', orderResponse.data?.data?.order?.order_number);
      console.log('');

      // Verify order_items were created
      const orderId = orderResponse.data?.data?.order?.id;
      if (orderId) {
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderId);

        if (orderItems && orderItems.length > 0) {
          console.log('✅ Order items verified:', orderItems.length, 'items');
          orderItems.forEach((item, index) => {
            console.log(`   Item ${index + 1}: ${item.product_name} x ${item.quantity} @ ₹${item.unit_price}`);
          });
        } else {
          console.error('❌ NO ORDER ITEMS FOUND! Order is orphaned.');
          console.error('   Items error:', itemsError?.message);
        }
      }

    } catch (orderError) {
      console.error('');
      console.error('❌ ORDER CREATION FAILED!');
      console.error('   Status:', orderError.response?.status);
      console.error('   Message:', orderError.response?.data?.message);
      console.error('   Error:', orderError.response?.data?.error);
      console.error('');
      console.error('Full response:', JSON.stringify(orderError.response?.data, null, 2));
    }

  } catch (error) {
    console.error('❌ Product fetch failed:', error.message);
  }
  console.log('');

  // TEST 10: Create order WITHOUT authentication (guest checkout)
  console.log('👤 TEST 10: Testing guest checkout (no auth token)...');
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price')
    .limit(1);

  if (products && products.length > 0) {
    const guestOrderData = {
      guestUuid: crypto.randomUUID(),
      orderItems: [{
        product: products[0].id,
        name: products[0].name,
        quantity: 1,
        price: products[0].price,
        size: 'M',
        color: 'Blue'
      }],
      shippingAddress: {
        fullName: 'Guest User',
        doorNo: '456',
        street: 'Guest Street',
        city: 'Guest City',
        state: 'Guest State',
        pinCode: '654321',
        email: 'guest@example.com',
        phone: '8888888888'
      },
      contactDetails: {
        name: 'Guest User',
        email: 'guest@example.com',
        phone: '8888888888'
      },
      paymentMethod: 'COD',
      itemsPrice: products[0].price,
      taxPrice: 0,
      shippingPrice: 0,
      discount: 0,
      totalPrice: products[0].price
    };

    try {
      const guestResponse = await axios.post(`${API_URL}/orders`, guestOrderData, {
        headers: {
          'Content-Type': 'application/json'
          // NO Authorization header
        }
      });

      console.log('✅ Guest order created successfully!');
      console.log('   Order ID:', guestResponse.data?.data?.order?.id);
      console.log('   Guest UUID:', guestResponse.data?.data?.order?.guest_uuid);
    } catch (guestError) {
      console.error('❌ Guest order failed:');
      console.error('   Status:', guestError.response?.status);
      console.error('   Message:', guestError.response?.data?.message);
    }
  }

  console.log('');
  console.log('=' .repeat(50));
  console.log('🏁 DIAGNOSTIC TEST COMPLETE');
  console.log('=' .repeat(50));
}

runTests().catch(console.error);
