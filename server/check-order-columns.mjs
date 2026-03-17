import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://srdljxbumxkgjxoqqrzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZGxqeGJ1bXhrZ2p4b3FxcnpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDAwODgyOSwiZXhwIjoyMDQ5NTg0ODI5fQ.RdVoKHp5uE_ChtpwgEz8Ky5M7Zm9RwJwzx0_UR5_N5o';
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Checking orders table columns...\n');

// Try to select both status and order_status
const { data, error } = await supabase
  .from('orders')
  .select('id, status, order_status')
  .limit(1);

if (error) {
  console.error('❌ Error:', error.message);
  console.log('\n📋 This tells us which columns exist and which do not.');
} else {
  console.log('✅ Query successful! Both columns might exist.');
  console.log('Sample data:', JSON.stringify(data, null, 2));
}

// Now try just status
console.log('\n🔍 Testing status column only...');
const { data: data1, error: error1 } = await supabase
  .from('orders')
  .select('id, status')
  .limit(1);

if (error1) {
  console.error('❌ status column does not exist:', error1.message);
} else {
  console.log('✅ status column exists');
  console.log('Sample:', data1);
}

// Now try just order_status
console.log('\n🔍 Testing order_status column only...');
const { data: data2, error: error2 } = await supabase
  .from('orders')
  .select('id, order_status')
  .limit(1);

if (error2) {
  console.error('❌ order_status column does not exist:', error2.message);
} else {
  console.log('✅ order_status column exists');
  console.log('Sample:', data2);
}

process.exit(0);
