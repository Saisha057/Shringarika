import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);

// Test each column group one by one to find which ones exist
const groups = [
  'id, order_number, user_id, guest_uuid, customer_name, customer_email, customer_phone',
  'order_items, shipping_address, contact_details',
  'payment_method, payment_status, payment_result',
  'razorpay_payment_id, razorpay_order_id',
  'subtotal, tax, delivery_charge, discount, total_price, total_amount',
  'order_status, status_history, estimated_delivery_date',
  'is_paid, paid_at, is_delivered, delivered_at',
  'billing_address, items_price, tax_price, shipping_price, currency',
  'delivery_notes, created_at, updated_at'
];

for (const cols of groups) {
  const { data, error } = await s.from('orders').select(cols).limit(1);
  if (error) {
    console.log(`❌ MISSING in: [${cols}] → ${error.message}`);
  } else {
    console.log(`✅ EXISTS: [${cols}]`);
  }
}
