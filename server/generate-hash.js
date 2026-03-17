import bcrypt from 'bcryptjs';

async function generateHash() {
  const password = 'Admin@123456';
  const hash = await bcrypt.hash(password, 10);
  
  console.log('\n🔑 PASSWORD HASH GENERATED\n');
  console.log('Password:', password);
  console.log('\nHash:');
  console.log(hash);
  console.log('\n📋 RUN THIS SQL IN SUPABASE:\n');
  console.log('─────────────────────────────────────────────────────');
  console.log(`UPDATE users SET password = '${hash}' WHERE email = 'shringarika11@gmail.com';`);
  console.log('─────────────────────────────────────────────────────');
  console.log('\n🔗 https://supabase.com/dashboard/project/_/sql');
  console.log('\n✅ After running SQL, login with:');
  console.log('   Email: shringarika11@gmail.com');
  console.log('   Password: Admin@123456');
  console.log('\n🌐 http://localhost:3000/admin\n');
}

generateHash();
