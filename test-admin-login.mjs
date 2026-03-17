import http from 'http';

async function testAdminLogin() {
  console.log('🔐 Testing Admin Login...\n');
  console.log('Email: shringarika11@gmail.com');
  console.log('Password: Admin@123456\n');

  const postData = JSON.stringify({
    email: 'shringarika11@gmail.com',
    password: 'Admin@123456'
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('📊 Response Status:', res.statusCode);
        console.log('📊 Response OK:', res.statusCode >= 200 && res.statusCode < 300);
        
        try {
          const jsonData = JSON.parse(data);
          console.log('\n📦 Response Data:');
          console.log(JSON.stringify(jsonData, null, 2));

          if (res.statusCode >= 200 && res.statusCode < 300 && jsonData.status === 'success') {
            console.log('\n✅ LOGIN SUCCESSFUL!');
            console.log('🎉 Token received:', jsonData.token?.substring(0, 30) + '...');
            console.log('👤 User:', jsonData.user?.email);
            console.log('👑 Role:', jsonData.user?.role);
            
            if (jsonData.user?.role === 'admin') {
              console.log('\n🎊 ADMIN ACCESS GRANTED! You can now access the admin dashboard.');
            } else {
              console.log('\n⚠️ Warning: User is not an admin. Role:', jsonData.user?.role);
            }
          } else {
            console.log('\n❌ LOGIN FAILED!');
            console.log('Error:', jsonData.message || 'Unknown error');
            
            if (res.statusCode === 401) {
              console.log('\n🔑 Password issue:');
              console.log('   The password "Admin@123456" is incorrect.');
              console.log('   Please run the SQL in UPDATE_ADMIN_PASSWORD.sql to fix it.');
            }
          }
          resolve();
        } catch (error) {
          console.error('\n❌ Error parsing response:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ ERROR:', error.message);
      console.log('\n💡 Make sure:');
      console.log('   1. Backend server is running on port 5000');
      console.log('   2. Run: cd server && npm run server');
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

testAdminLogin().catch(console.error);
