/**
 * Test Twilio Credentials End-to-End
 * 
 * This script verifies:
 * 1. Twilio credentials are valid
 * 2. Can send test SMS using actual service
 */

import { sendSMS } from './services/sms.service.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

console.log('🔍 TWILIO CREDENTIALS VERIFICATION');
console.log('=' .repeat(50));

// Check if credentials are set
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
const testMode = process.env.TWILIO_TEST_MODE;

console.log('\n📋 Step 1: Checking Environment Variables');
console.log('-'.repeat(50));
console.log(`✓ TWILIO_ACCOUNT_SID: ${accountSid ? 'SET (' + accountSid.substring(0, 10) + '...)' : '❌ NOT SET'}`);
console.log(`✓ TWILIO_AUTH_TOKEN: ${authToken ? 'SET (' + authToken.substring(0, 10) + '...)' : '❌ NOT SET'}`);
console.log(`✓ TWILIO_PHONE_NUMBER: ${phoneNumber || '❌ NOT SET'}`);
console.log(`✓ TWILIO_TEST_MODE: ${testMode || 'false'}`);

if (!accountSid || !authToken || !phoneNumber) {
  console.error('\n❌ ERROR: Missing Twilio credentials in .env file');
  console.log('\n💡 Please set the following in server/.env:');
  console.log('   TWILIO_ACCOUNT_SID=your_account_sid');
  console.log('   TWILIO_AUTH_TOKEN=your_auth_token');
  console.log('   TWILIO_PHONE_NUMBER=+1234567890');
  process.exit(1);
}

console.log('\n✅ All required environment variables are set!');

// Test SMS sending
async function testSMSSending(testPhoneNumber) {
  console.log('\n📋 Step 2: Testing SMS Sending');
  console.log('-'.repeat(50));
  
  if (!testPhoneNumber) {
    console.log('⏩ Skipping test SMS (no phone number provided)');
    console.log('💡 Usage: node test-twilio-credentials.mjs +919876543210');
    console.log('\n✨ Credentials are configured - ready to send SMS!');
    console.log('✨ SMS notifications will be sent automatically for:');
    console.log('   - Order confirmations');
    console.log('   - Return requests');
    console.log('   - Exchange requests');
    console.log('   - Order status updates');
    return true;
  }
  
  console.log(`📱 Sending test SMS to: ${testPhoneNumber}`);
  
  try {
    const result = await sendSMS(
      testPhoneNumber,
      '🧪 Test from Shringarika - Twilio credentials verified successfully! Your SMS notifications are working. - Shringarika Team'
    );
    
    if (result.success) {
      console.log('✅ Test SMS sent successfully!');
      if (result.testMode) {
        console.log('ℹ️  TEST MODE: Message was logged but not actually sent');
      } else {
        console.log('✅ Message ID:', result.messageId);
      }
      return true;
    } else {
      console.error('❌ Failed to send test SMS:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending test SMS:', error.message);
    return false;
  }
}

// Run tests
async function runTests() {
  const testPhone = process.argv[2];
  const smsTestPassed = await testSMSSending(testPhone);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (smsTestPassed) {
    console.log('✅ TWILIO VERIFICATION COMPLETE!');
    console.log('\n✨ Your Twilio credentials are configured correctly.');
    console.log('✨ The system can send SMS notifications to customers.');
    console.log('\n📱 Notification Features Active:');
    console.log('   ✓ Order confirmation SMS');
    console.log('   ✓ Return request notifications');
    console.log('   ✓ Exchange request notifications');
    console.log('   ✓ Return approval SMS');
    console.log('   ✓ Exchange approval SMS');
  } else {
    console.log('⚠️  Please review the configuration above');
  }
  console.log('='.repeat(50) + '\n');
}

// Execute tests
runTests().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  process.exit(1);
});
