/**
 * 🚀 QUICK SMS TEST - 1 Minute Verification
 * 
 * This sends a test SMS RIGHT NOW to verify Twilio works.
 * Run: node QUICK_SMS_TEST.js +919876543210
 */

import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

console.log('\n🚀 QUICK SMS TEST\n');

// Get phone number from command line
const testPhone = process.argv[2];

if (!testPhone) {
  console.error('❌ Error: No phone number provided');
  console.log('\nUsage:');
  console.log('  node QUICK_SMS_TEST.js +919876543210');
  console.log('\nMake sure to include country code (+91 for India)');
  process.exit(1);
}

if (!accountSid || !authToken || !twilioPhone) {
  console.error('❌ Error: Twilio credentials missing in .env');
  console.error('   Check: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
  process.exit(1);
}

console.log('Settings:');
console.log(`  From: ${twilioPhone}`);
console.log(`  To: ${testPhone}`);
console.log('');

try {
  const client = twilio(accountSid, authToken);
  
  console.log('📱 Sending test SMS...\n');
  
  const message = await client.messages.create({
    body: '🧪 Test SMS from Shringarika backend. If you received this, SMS delivery is working!',
    from: twilioPhone,
    to: testPhone,
  });
  
  console.log('✅ SMS SENT!');
  console.log('');
  console.log('Details:');
  console.log(`  Message SID: ${message.sid}`);
  console.log(`  Status: ${message.status}`);
  console.log(`  Direction: ${message.direction}`);
  console.log('');
  console.log('Check delivery status at:');
  console.log(`  https://console.twilio.com/us1/monitor/logs/sms/${message.sid}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Check your phone for the SMS');
  console.log('  2. If delivered → Your Twilio setup works!');
  console.log('  3. If not delivered → Check error code in Twilio console');
  console.log('');
  
} catch (error) {
  console.error('❌ SMS FAILED\n');
  console.error(`Error Code: ${error.code || 'Unknown'}`);
  console.error(`Error: ${error.message}`);
  console.error('');
  
  if (error.code === 21211) {
    console.error('💡 Fix: Invalid phone number format');
    console.error('   Use: +CountryCodeNumber (e.g., +919876543210)');
  } else if (error.code === 21408 || error.code === 21612) {
    console.error('💡 Fix: Trial account restriction');
    console.error('   Verify phone at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
    console.error('   OR upgrade account');
  } else if (error.code === 20003) {
    console.error('💡 Fix: Authentication failed');
    console.error('   Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
  }
}
