import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// Admin credentials
const ADMIN_EMAIL = 'shringarik11@gmail.com';
const ADMIN_PASSWORD = 'Admin@123456';

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createAdminUser() {
  const client = await pool.connect();
  
  try {
    console.log('🔐 Creating admin user...\n');
    
    // Hash password
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    
    // Check if user exists
    const checkUser = await client.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [ADMIN_EMAIL]
    );
    
    if (checkUser.rows.length > 0) {
      const user = checkUser.rows[0];
      
      if (user.role === 'admin') {
        console.log('✅ Admin user already exists!');
        console.log(`📧 Email: ${user.email}`);
        console.log(`🔑 Role: ${user.role}`);
        console.log(`🆔 ID: ${user.id}\n`);
        return user;
      } else {
        // Update existing user to admin
        await client.query(
          'UPDATE users SET role = $1, is_active = true, is_verified = true, updated_at = NOW() WHERE email = $2',
          ['admin', ADMIN_EMAIL]
        );
        
        console.log('✅ Existing user upgraded to admin!');
        console.log(`📧 Email: ${ADMIN_EMAIL}`);
        console.log(`🔑 New Role: admin\n`);
        return user;
      }
    }
    
    // Create new admin user
    const result = await client.query(
      `INSERT INTO users (email, password_hash, role, is_active, is_verified, created_at, updated_at)
       VALUES ($1, $2, $3, true, true, NOW(), NOW())
       RETURNING id, email, role, created_at`,
      [ADMIN_EMAIL, hashedPassword, 'admin']
    );
    
    const newUser = result.rows[0];
    
    console.log('✅ Admin user created successfully!');
    console.log(`📧 Email: ${newUser.email}`);
    console.log(`🔑 Role: ${newUser.role}`);
    console.log(`🆔 ID: ${newUser.id}`);
    console.log(`📅 Created: ${newUser.created_at}\n`);
    
    // Create admin profile
    await client.query(
      `INSERT INTO profiles (user_id, first_name, last_name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id, 'Admin', 'Shringarika']
    );
    
    console.log('✅ Admin profile created!\n');
    
    return newUser;
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function verifyAdminAccess() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verifying admin access...\n');
    
    const result = await client.query(
      `SELECT u.id, u.email, u.role, u.is_active, u.is_verified, 
              p.first_name, p.last_name
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.email = $1`,
      [ADMIN_EMAIL]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Admin user not found!\n');
      return false;
    }
    
    const admin = result.rows[0];
    
    console.log('✅ Admin user verified!');
    console.log('─────────────────────────────');
    console.log(`📧 Email: ${admin.email}`);
    console.log(`👤 Name: ${admin.first_name || 'N/A'} ${admin.last_name || ''}`);
    console.log(`🔑 Role: ${admin.role}`);
    console.log(`✓ Active: ${admin.is_active ? 'Yes' : 'No'}`);
    console.log(`✓ Verified: ${admin.is_verified ? 'Yes' : 'No'}`);
    console.log(`🆔 ID: ${admin.id}`);
    console.log('─────────────────────────────\n');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error verifying admin:', error.message);
    return false;
  } finally {
    client.release();
  }
}

// Main execution
(async () => {
  try {
    console.log('🚀 Setting up admin account for Shringarika\n');
    console.log('📦 Database:', process.env.SUPABASE_URL);
    console.log('─────────────────────────────\n');
    
    await createAdminUser();
    await verifyAdminAccess();
    
    console.log('🎉 Admin setup completed successfully!');
    console.log('\n📝 Login Credentials:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('\n⚠️  Please change the password after first login!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
