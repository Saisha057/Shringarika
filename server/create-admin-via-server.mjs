/**
 * Admin user upsert script - runs INSIDE server/ so dotenv loads correctly.
 * Usage: run from server/ directory:  node create-admin-via-server.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import https from 'https';

// Load .env from server directory (same as server.js does)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Admin credentials ───────────────────────────────────────────────────────
const ADMIN_EMAIL    = 'shringarika11@gmail.com';
const ADMIN_PASSWORD = 'Admin@123456';
const ADMIN_NAME     = 'Shringarika Admin';
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n🔧  Admin user upsert script');
console.log('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌ MISSING');
console.log('   SERVICE KEY :', SUPABASE_KEY ? `✅ (${SUPABASE_KEY.length} chars)` : '❌ MISSING');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌  Missing Supabase credentials.');
  process.exit(1);
}

// Helper: make HTTPS request using Node's built-in https module (bypasses fetch TLS issues)
function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : null;
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // 1. Hash password
  const salt   = await bcrypt.genSalt(12);
  const pwHash = await bcrypt.hash(ADMIN_PASSWORD, salt);
  console.log('✅  Password hashed');

  // 2. Check if user already exists
  const checkUrl = `/rest/v1/users?email=eq.${encodeURIComponent(ADMIN_EMAIL)}&select=id,email,role`;
  const checkRes = await supabaseRequest('GET', checkUrl, null);
  console.log('   DB check status:', checkRes.status);

  if (checkRes.status !== 200) {
    console.error('❌  Could not query users table:', checkRes.status, JSON.stringify(checkRes.data));
    process.exit(1);
  }

  const users = checkRes.data || [];
  console.log('   Existing users found:', users.length);

  let result;
  if (users.length > 0) {
    // 3a. Update existing user
    const uid = users[0].id;
    console.log('ℹ️   Updating existing user id:', uid, 'current role:', users[0].role);
    result = await supabaseRequest('PATCH', `/rest/v1/users?id=eq.${uid}`, {
      password_hash: pwHash,
      role         : 'admin',
      is_active    : true,
      updated_at   : new Date().toISOString(),
    });
    console.log('   Update status:', result.status);
    if (result.status < 200 || result.status > 299) {
      console.error('❌  Update failed:', JSON.stringify(result.data));
      process.exit(1);
    }
    console.log('✅  Password reset and role set to admin');
  } else {
    // 3b. Insert new user
    console.log('ℹ️   User does not exist — creating new admin user...');
    result = await supabaseRequest('POST', '/rest/v1/users', {
      email        : ADMIN_EMAIL,
      password_hash: pwHash,
      role         : 'admin',
      is_active    : true,
      created_at   : new Date().toISOString(),
      updated_at   : new Date().toISOString(),
    });
    console.log('   Insert status:', result.status);
    if (result.status < 200 || result.status > 299) {
      console.error('❌  Insert failed:', JSON.stringify(result.data));
      process.exit(1);
    }
    console.log('✅  New admin user created');
  }

  console.log('\n══════════════════════════════════════════');
  console.log('  ✅ Admin credentials ready:');
  console.log('  Email   :', ADMIN_EMAIL);
  console.log('  Password:', ADMIN_PASSWORD);
  console.log('══════════════════════════════════════════');
  console.log('\n  Login at: http://localhost:3000\n');

  process.exit(0);
}

run().catch(e => { console.error('❌ Fatal:', e.message || e); process.exit(1); });
