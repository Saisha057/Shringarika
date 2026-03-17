#!/usr/bin/env node

import axios from 'axios';

const API_BASE = 'http://localhost:5000';

async function testAdminAPI() {
  console.log('🔍 Testing Admin API Connection...\n');
  
  // First, try to login to get a valid token
  try {
    console.log('1️⃣ Testing login...');
    const loginRes = await axios.post(`${API_BASE}/api/auth/login`, {
      email: 'saishadubey0112@gmail.com',
      password: 'dub2004' // You'll need to replace this or use the correct password
    });
    
    console.log('✅ Login successful!');
    console.log('Token received:', loginRes.data.token?.substring(0, 30) + '...');
    
    const token = loginRes.data.token;
    
    // Now test the admin endpoints
    console.log('\n2️⃣ Testing /api/admin/orders with token...');
    try {
      const ordersRes = await axios.get(`${API_BASE}/api/admin/orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ /api/admin/orders: SUCCESS');
      console.log(`   Found ${ordersRes.data.data?.orders?.length || 0} orders`);
    } catch (error) {
      console.error('❌ /api/admin/orders: FAILED');
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Message: ${error.response?.data?.message}`);
    }
    
    console.log('\n3️⃣ Testing /api/admin/users with token...');
    try {
      const usersRes = await axios.get(`${API_BASE}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ /api/admin/users: SUCCESS');
      console.log(`   Found ${usersRes.data.data?.users?.length || 0} users`);
    } catch (error) {
      console.error('❌ /api/admin/users: FAILED');
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Message: ${error.response?.data?.message}`);
    }
    
    console.log('\n4️⃣ Testing /api/admin/dashboard with token...');
    try {
      const dashRes = await axios.get(`${API_BASE}/api/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ /api/admin/dashboard: SUCCESS');
      console.log(`   Total Revenue: ${dashRes.data.data?.metrics?.totalRevenue}`);
      console.log(`   Total Orders: ${dashRes.data.data?.metrics?.totalOrders}`);
      console.log(`   Total Users: ${dashRes.data.data?.metrics?.totalUsers}`);
    } catch (error) {
      console.error('❌ /api/admin/dashboard: FAILED');
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Message: ${error.response?.data?.message}`);
    }
    
  } catch (error) {
    console.error('❌ Login failed!');
    console.error('Make sure the backend server is running and the credentials are correct');
    console.error('Error:', error.message);
  }
}

testAdminAPI();
