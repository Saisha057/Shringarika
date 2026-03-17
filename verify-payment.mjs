#!/usr/bin/env node

/**
 * Razorpay Payment Fix v2 - Verification Script
 * 
 * This script helps verify that the database order update fix is working correctly.
 * Run this AFTER completing a test payment to check if order was updated.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyOrderUpdate(orderIdentifier) {
  console.log('🔍 Searching for order:', orderIdentifier);
  
  // Try by order_number
  let { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', orderIdentifier)
    .single();
  
  // Try by id if not found
  if (error && error.code === 'PGRST116') {
    console.log('⚠️ Not found by order_number, trying by id...');
    const result = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderIdentifier)
      .single();
    
    order = result.data;
    error = result.error;
  }
  
  if (error) {
    console.error('❌ Order not found:', error);
    return;
  }
  
  console.log('\n✅ Order found!');
  console.log('───────────────────────────────────────');
  console.log('Order Number:', order.order_number);
  console.log('Order Status:', order.order_status);
  console.log('Payment Status:', order.payment_status);
  console.log('Is Paid:', order.is_paid);
  console.log('Total Amount:', order.total_amount);
  console.log('───────────────────────────────────────');
  console.log('Razorpay Order ID:', order.razorpay_order_id);
  console.log('Razorpay Payment ID:', order.razorpay_payment_id);
  console.log('Payment Method:', order.payment_method);
  console.log('───────────────────────────────────────');
  
  // Verify payment was processed
  if (order.payment_status === 'paid' && order.is_paid && order.order_status === 'Confirmed') {
    console.log('\n✅ PAYMENT SUCCESSFULLY PROCESSED!');
  } else {
    console.log('\n⚠️ WARNING: Payment may not be fully processed');
    console.log('Expected:');
    console.log('  - payment_status: "paid"');
    console.log('  - is_paid: true');
    console.log('  - order_status: "Confirmed"');
    console.log('\nActual:');
    console.log('  - payment_status:', order.payment_status);
    console.log('  - is_paid:', order.is_paid);
    console.log('  - order_status:', order.order_status);
  }
}

async function findRecentOrders(limit = 5) {
  console.log(`🔍 Finding ${limit} most recent orders...\n`);
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('order_number, order_status, payment_status, is_paid, total_amount, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('❌ Error fetching orders:', error);
    return;
  }
  
  if (!orders || orders.length === 0) {
    console.log('No orders found.');
    return;
  }
  
  console.log('Recent Orders:');
  console.log('───────────────────────────────────────────────────────────────────');
  orders.forEach((order, index) => {
    const paidIcon = order.is_paid ? '✅' : '❌';
    const statusIcon = order.order_status === 'Confirmed' ? '✅' : '⏳';
    console.log(`${index + 1}. ${order.order_number}`);
    console.log(`   Status: ${statusIcon} ${order.order_status} | Payment: ${paidIcon} ${order.payment_status}`);
    console.log(`   Amount: ₹${order.total_amount} | Created: ${new Date(order.created_at).toLocaleString()}`);
    console.log('');
  });
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('📋 Razorpay Payment Fix - Order Verification Tool\n');
  findRecentOrders().then(() => {
    console.log('\n💡 Usage:');
    console.log('  node verify-payment.mjs <order_number>  # Check specific order');
    console.log('  node verify-payment.mjs                  # Show recent orders');
  });
} else {
  const orderIdentifier = args[0];
  verifyOrderUpdate(orderIdentifier);
}
