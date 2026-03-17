/**
 * Quick Test Script for Users API
 * 
 * This script tests the /api/users endpoint to verify:
 * 1. Backend server is running
 * 2. Admin authentication works
 * 3. Users are being fetched from database
 * 
 * Usage:
 *   1. Make sure backend server is running (cd server && npm start)
 *   2. Update ADMIN_EMAIL and ADMIN_PASSWORD below
 *   3. Run: node test-users-api.mjs
 */

const BASE_URL = 'http://localhost:5000';
const ADMIN_EMAIL = 'admin@example.com';  // ⚠️ REPLACE WITH YOUR ADMIN EMAIL
const ADMIN_PASSWORD = 'your-password';   // ⚠️ REPLACE WITH YOUR ADMIN PASSWORD

async function testUsersAPI() {
  console.log('🧪 Starting Users API Test\n');
  console.log('=' .repeat(50));
  
  // Step 1: Check server health
  console.log('\n1️⃣  TESTING SERVER HEALTH');
  console.log('-'.repeat(50));
  try {
    const healthResponse = await fetch(`${BASE_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Server returned ${healthResponse.status}`);
    }
    const healthData = await healthResponse.json();
    console.log('✅ Server is running');
    console.log('   Status:', healthData.status);
    console.log('   Message:', healthData.message);
  } catch (err) {
    console.error('❌ Server is NOT running!');
    console.error('   Error:', err.message);
    console.error('\n💡 Fix: Start backend server with:');
    console.error('   cd server');
    console.error('   npm start\n');
    return;
  }
  
  // Step 2: Test login
  console.log('\n2️⃣  TESTING ADMIN LOGIN');
  console.log('-'.repeat(50));
  let token;
  try {
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
      throw new Error(loginData.message || 'Login failed');
    }
    
    token = loginData.data.token;
    console.log('✅ Login successful');
    console.log('   Email:', ADMIN_EMAIL);
    console.log('   Token:', token.substring(0, 30) + '...');
    
  } catch (err) {
    console.error('❌ Login failed!');
    console.error('   Error:', err.message);
    console.error('\n💡 Fix: Update ADMIN_EMAIL and ADMIN_PASSWORD in this script');
    console.error('   Or create admin user in your application\n');
    return;
  }
  
  // Step 3: Test users endpoint
  console.log('\n3️⃣  TESTING GET /api/users');
  console.log('-'.repeat(50));
  try {
    const usersResponse = await fetch(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!usersResponse.ok) {
      const errorData = await usersResponse.json().catch(() => ({}));
      
      if (usersResponse.status === 401) {
        throw new Error('Unauthorized - Token is invalid');
      } else if (usersResponse.status === 403) {
        throw new Error('Forbidden - User is not admin. Run: UPDATE users SET role = \'admin\' WHERE email = \'' + ADMIN_EMAIL + '\';');
      } else if (usersResponse.status === 500) {
        throw new Error('Server error - Check backend console logs');
      } else {
        throw new Error(`HTTP ${usersResponse.status}: ${errorData.message || 'Unknown error'}`);
      }
    }
    
    const usersData = await usersResponse.json();
    
    if (usersData.status !== 'success') {
      throw new Error('Unexpected response status: ' + usersData.status);
    }
    
    const users = usersData.data.users;
    
    console.log('✅ Users endpoint successful!');
    console.log(`   Total users: ${users.length}`);
    console.log('   Status:', usersData.status);
    
    if (users.length === 0) {
      console.log('\n⚠️  WARNING: No users found in database!');
      console.log('   This means:');
      console.log('   - No users have registered yet, OR');
      console.log('   - Users are being stored in a different database');
      console.log('\n💡 Create a test user:');
      console.log('   1. Go to your app registration page');
      console.log('   2. Register a new user');
      console.log('   3. Run this test again\n');
    } else {
      console.log('\n👥 USER LIST:');
      console.log('='.repeat(50));
      users.forEach((user, i) => {
        console.log(`\n${i+1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone || 'N/A'}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Joined: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log(`   Orders: ${user.stats.totalOrders}`);
        console.log(`   Spent: ₹${user.stats.totalSpent}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Users endpoint failed!');
    console.error('   Error:', err.message);
    return;
  }
  
  // Step 4: Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ ALL TESTS PASSED!');
  console.log('='.repeat(50));
  console.log('\nYour Admin Users Page should now work correctly.');
  console.log('If the frontend still shows 0 users:');
  console.log('  1. Make sure frontend dev server is running (npm run dev)');
  console.log('  2. Hard refresh the page (Ctrl+Shift+R)');
  console.log('  3. Check browser console for errors (F12)');
  console.log('  4. Check Network tab for /api/users request');
  console.log('  5. Verify you are logged in as admin user\n');
}

// Run the test
testUsersAPI().catch(err => {
  console.error('\n💥 Unexpected error:', err);
  console.error('\nStack trace:', err.stack);
});
