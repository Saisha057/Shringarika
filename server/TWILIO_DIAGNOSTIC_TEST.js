/**
 * 🔬 COMPREHENSIVE TWILIO SMS DIAGNOSTIC TEST
 * 
 * This script tests all potential SMS failure points:
 * 1️⃣ Environment variables loaded correctly
 * 2️⃣ Twilio credentials valid
 * 3️⃣ Phone number format (E.164)
 * 4️⃣ Trial vs Paid account status
 * 5️⃣ Indian DLT requirements
 * 6️⃣ Actual SMS delivery
 * 
 * RUN THIS FIRST before implementing OTP or debugging further
 */

import twilio from 'twilio';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('='.repeat(80));
console.log('🔬 TWILIO SMS DIAGNOSTIC TEST - COMPREHENSIVE ANALYSIS');
console.log('='.repeat(80));
console.log('');

// ==========================================
// TEST 1: Environment Variables Check
// ==========================================
console.log('📋 TEST 1: Environment Variables Check');
console.log('-'.repeat(80));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const testMode = process.env.TWILIO_TEST_MODE;

console.log('TWILIO_ACCOUNT_SID:', accountSid ? `✅ SET (${accountSid.substring(0, 10)}...)` : '❌ NOT SET');
console.log('TWILIO_AUTH_TOKEN:', authToken ? `✅ SET (${authToken.substring(0, 10)}...)` : '❌ NOT SET');
console.log('TWILIO_PHONE_NUMBER:', twilioPhone ? `✅ SET (${twilioPhone})` : '❌ NOT SET');
console.log('TWILIO_TEST_MODE:', testMode || 'false');
console.log('');

if (!accountSid || !authToken || !twilioPhone) {
  console.error('❌ CRITICAL ERROR: Twilio credentials missing in .env file');
  console.error('💡 Fix: Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to server/.env');
  process.exit(1);
}

// ==========================================
// TEST 2: Twilio Client Initialization
// ==========================================
console.log('📋 TEST 2: Twilio Client Initialization');
console.log('-'.repeat(80));

let client;
try {
  client = twilio(accountSid, authToken);
  console.log('✅ Twilio client initialized successfully');
  console.log('');
} catch (error) {
  console.error('❌ CRITICAL ERROR: Failed to initialize Twilio client');
  console.error('Error:', error.message);
  console.error('💡 Fix: Verify your Account SID and Auth Token are correct');
  process.exit(1);
}

// ==========================================
// TEST 3: Account Type Check (Trial vs Paid)
// ==========================================
console.log('📋 TEST 3: Account Type Check (Trial vs Paid)');
console.log('-'.repeat(80));

try {
  const account = await client.api.accounts(accountSid).fetch();
  
  console.log('Account Status:', account.status);
  console.log('Account Type:', account.type || 'Unknown');
  console.log('');
  
  if (account.type === 'Trial' || account.status === 'active') {
    console.log('⚠️  WARNING: You are on a TRIAL account');
    console.log('⚠️  SMS will ONLY be delivered to VERIFIED phone numbers');
    console.log('💡 Fix: Either');
    console.log('   1. Verify target phone numbers at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
    console.log('   2. OR upgrade to paid account: https://console.twilio.com/us1/billing/manage-billing/upgrade');
    console.log('');
  } else {
    console.log('✅ Paid account detected - can send to any number');
    console.log('');
  }
} catch (error) {
  console.error('⚠️  Could not check account type:', error.message);
  console.log('');
}

// ==========================================
// TEST 4: Sender Phone Number Validation
// ==========================================
console.log('📋 TEST 4: Sender Phone Number Validation');
console.log('-'.repeat(80));

try {
  const incomingPhoneNumbers = await client.incomingPhoneNumbers.list({ limit: 20 });
  
  console.log(`Found ${incomingPhoneNumbers.length} phone number(s) in your account:`);
  
  const hasTwilioPhone = incomingPhoneNumbers.some(num => num.phoneNumber === twilioPhone);
  
  incomingPhoneNumbers.forEach(num => {
    const isSelected = num.phoneNumber === twilioPhone;
    console.log(`  ${isSelected ? '✅' : '  '} ${num.phoneNumber} - ${num.friendlyName}`);
  });
  console.log('');
  
  if (!hasTwilioPhone) {
    console.error(`❌ WARNING: ${twilioPhone} is NOT in your account`);
    console.error('💡 Fix: Update TWILIO_PHONE_NUMBER in .env to match one of the numbers above');
    console.log('');
  } else {
    console.log(`✅ Sender phone number ${twilioPhone} is valid`);
    console.log('');
  }
} catch (error) {
  console.error('⚠️  Could not verify phone numbers:', error.message);
  console.log('');
}

// ==========================================
// TEST 5: Phone Number Format Test
// ==========================================
console.log('📋 TEST 5: Phone Number Format Test');
console.log('-'.repeat(80));

const testPhones = [
  '9876543210',           // ❌ No country code
  '+91 98765 43210',      // ❌ Spaces
  '+919876543210',        // ✅ Correct E.164
  '919876543210',         // ⚠️  Missing + sign
];

console.log('Testing phone number formats:');
testPhones.forEach(phone => {
  const isValid = /^\+\d{10,15}$/.test(phone);
  console.log(`  ${isValid ? '✅' : '❌'} ${phone} ${isValid ? '(Valid E.164)' : '(INVALID - must be +CountryCodeNumber)'}`);
});
console.log('');
console.log('💡 Your app MUST format numbers as +91XXXXXXXXXX before sending to Twilio');
console.log('');

// ==========================================
// TEST 6: Indian SMS (DLT) Compliance Check
// ==========================================
console.log('📋 TEST 6: Indian SMS (DLT) Compliance Check');
console.log('-'.repeat(80));

console.log('⚠️  CRITICAL FOR INDIA: DLT (Distributed Ledger Technology) Requirements');
console.log('');
console.log('To send SMS to Indian numbers (+91), you MUST:');
console.log('  1. Register with a DLT platform (Airtel, Jio, Vodafone)');
console.log('  2. Register your Sender ID (e.g., "SHRING")');
console.log('  3. Register your SMS template and get Template ID');
console.log('  4. Add Template ID to Twilio messages');
console.log('');
console.log('Without DLT registration:');
console.log('  ❌ Twilio API will return 200 OK');
console.log('  ❌ SMS will be SILENTLY DROPPED by Indian carriers');
console.log('  ❌ No error message will appear');
console.log('');
console.log('💡 Quick Test: Try sending to a NON-INDIAN number first (e.g., +1234567890)');
console.log('   If that works, the issue is DLT');
console.log('');
console.log('📚 Learn more: https://www.twilio.com/docs/sms/regulatory/a2p-10dlc');
console.log('');

// ==========================================
// TEST 7: Actual SMS Send Test
// ==========================================
console.log('📋 TEST 7: Actual SMS Send Test');
console.log('-'.repeat(80));

console.log('⚠️  THIS TEST WILL USE ACTUAL CREDITS AND ATTEMPT TO SEND SMS');
console.log('');

// Ask for phone number
console.log('Enter test phone number (E.164 format, e.g., +919876543210):');
console.log('Or press Ctrl+C to skip');
console.log('');

// For automated testing, read from command line argument
const testPhoneNumber = process.argv[2];

if (testPhoneNumber) {
  console.log(`Testing SMS to: ${testPhoneNumber}`);
  console.log('');
  
  try {
    console.log('🚀 Sending test SMS...');
    
    const message = await client.messages.create({
      body: '🧪 Test SMS from Shringarika. If you received this, SMS is working! Reply STOP to unsubscribe.',
      from: twilioPhone,
      to: testPhoneNumber,
    });
    
    console.log('');
    console.log('✅ SMS SENT SUCCESSFULLY!');
    console.log('');
    console.log('Message Details:');
    console.log('  Message SID:', message.sid);
    console.log('  Status:', message.status);
    console.log('  To:', message.to);
    console.log('  From:', message.from);
    console.log('  Price:', message.price || 'Not yet available');
    console.log('  Direction:', message.direction);
    console.log('');
    console.log('💡 Check delivery status at:');
    console.log(`   https://console.twilio.com/us1/monitor/logs/sms/${message.sid}`);
    console.log('');
    
    // Wait and check final status
    console.log('⏳ Waiting 5 seconds to check delivery status...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const updatedMessage = await client.messages(message.sid).fetch();
    console.log('');
    console.log('Final Status:', updatedMessage.status);
    
    if (updatedMessage.status === 'delivered') {
      console.log('✅ SMS DELIVERED SUCCESSFULLY!');
      console.log('🎉 YOUR TWILIO SETUP IS WORKING PERFECTLY!');
    } else if (updatedMessage.status === 'sent') {
      console.log('✅ SMS SENT - Waiting for carrier delivery confirmation');
      console.log('💡 Check your phone in the next 30 seconds');
    } else if (updatedMessage.status === 'failed') {
      console.log('❌ SMS DELIVERY FAILED');
      console.log('Error Code:', updatedMessage.errorCode);
      console.log('Error Message:', updatedMessage.errorMessage);
      console.log('');
      console.log('Common failure reasons:');
      console.log('  21211: Invalid phone number');
      console.log('  21408: Permission denied (Trial account restriction)');
      console.log('  21612: Phone number not verified (Trial account)');
      console.log('  30007: Message filtered (Carrier/DLT restriction in India)');
    } else {
      console.log('⏳ Status:', updatedMessage.status);
      console.log('💡 SMS may still be in queue. Check Twilio console for updates.');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ FAILED TO SEND SMS');
    console.error('');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.error('');
    
    // Provide specific fix suggestions
    if (error.code === 21211) {
      console.error('💡 Fix: Phone number format is invalid. Use +CountryCodeNumber (e.g., +919876543210)');
    } else if (error.code === 21408) {
      console.error('💡 Fix: Trial account - verify this phone number at https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
    } else if (error.code === 21612) {
      console.error('💡 Fix: Phone not verified for trial account');
    } else if (error.code === 20003) {
      console.error('💡 Fix: Invalid authentication - check Account SID and Auth Token');
    }
  }
} else {
  console.log('ℹ️  Skipping actual SMS test (no phone number provided)');
  console.log('');
  console.log('To test SMS sending, run:');
  console.log('  node TWILIO_DIAGNOSTIC_TEST.js +919876543210');
  console.log('');
}

// ==========================================
// SUMMARY AND RECOMMENDATIONS
// ==========================================
console.log('='.repeat(80));
console.log('📊 DIAGNOSTIC SUMMARY AND RECOMMENDATIONS');
console.log('='.repeat(80));
console.log('');
console.log('✅ What to check:');
console.log('  1. All environment variables are SET ✓');
console.log('  2. Twilio client initializes successfully ✓');
console.log('  3. Account type (Trial vs Paid) - Check above');
console.log('  4. Sender phone number is valid - Check above');
console.log('  5. Phone numbers are in E.164 format (+CountryCodeNumber)');
console.log('  6. For Indian numbers: DLT registration required');
console.log('  7. Run actual SMS test with: node TWILIO_DIAGNOSTIC_TEST.js +91XXXXXXXXXX');
console.log('');
console.log('⚠️  MOST LIKELY ISSUES:');
console.log('  1. Trial account + phone not verified → Verify at console.twilio.com');
console.log('  2. Sending to India + No DLT → Register with DLT platform');
console.log('  3. Wrong phone format → Must start with +91');
console.log('');
console.log('🔴 REMEMBER: OTP verification will NOT fix SMS delivery issues!');
console.log('   Fix Twilio configuration FIRST, then implement OTP.');
console.log('');
console.log('='.repeat(80));
console.log('🏁 DIAGNOSTIC COMPLETE');
console.log('='.repeat(80));
