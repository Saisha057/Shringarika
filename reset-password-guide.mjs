// Reset password via backend API
async function resetPassword() {
  try {
    const email = 'shringarika11@gmail.com';
    const newPassword = 'Admin@123';
    
    console.log('\n🔐 RESETTING ADMIN PASSWORD VIA SUPABASE\n');
    console.log('Email:', email);
    console.log('New Password:', newPassword);
    console.log('\n⚠️  MANUAL RESET REQUIRED\n');
    console.log('Since the password is hashed in the database, you need to:');
    console.log('\n📋 Option 1: Use Supabase Dashboard');
    console.log('   1. Go to: https://supabase.com/dashboard');
    console.log('   2. Select your project');
    console.log('   3. Go to Authentication → Users');
    console.log('   4. Find: shringarika11@gmail.com');
    console.log('   5. Click "..." → Reset Password');
    console.log('   6. Set new password: Admin@123');
    console.log('\n📋 Option 2: Use SQL Query');
    console.log('   Run this in Supabase SQL Editor:');
    console.log('   ─────────────────────────────────────────────');
    console.log('   -- First, generate hash in Node.js:');
    console.log('   -- cd server && node');
    console.log('   -- const bcrypt = require("bcryptjs");');
    console.log('   -- bcrypt.hash("Admin@123", 10).then(console.log);');
    console.log('   -- Copy the hash, then run:');
    console.log('   ');
    console.log('   UPDATE users ');
    console.log('   SET password = \'your_generated_hash\'');
    console.log('   WHERE email = \'shringarika11@gmail.com\';');
    console.log('   ─────────────────────────────────────────────');
    console.log('\n📋 Option 3: Quick Hash Generator');
    console.log('   Run: cd server && node -e "const bcrypt = require(\'bcryptjs\'); bcrypt.hash(\'Admin@123\', 10).then(h => console.log(\'Hash:\', h));"');
    console.log('\n🔗 Supabase Dashboard: https://supabase.com/dashboard/project/_/auth/users');
    console.log('\n💡 After resetting, login at: http://localhost:3000/admin\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetPassword();
