// Quick test script to verify payment verification route exists
async function testVerifyRoute() {
  try {
    console.log('\n🧪 Testing payment verification route...\n');

    const response = await fetch('http://localhost:5000/api/payments/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Missing params intentionally to test error handling
      })
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 400 && data.error?.includes('Missing payment verification parameters')) {
      console.log('\n✅ SUCCESS: Route exists and validation is working!');
      console.log('   The route /api/payments/verify-payment is accessible');
      console.log('   Error handling is working correctly\n');
    } else if (response.status === 503) {
      console.log('\n⚠️  WARNING: Razorpay is not configured (missing API keys)');
      console.log('   But the route exists and is responding\n');
    } else {
      console.log('\n⚠️  Unexpected response - route may have issues\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR: Route not accessible or server not running');
    console.error('   Error:', error.message);
    console.error('   Make sure backend is running on port 5000\n');
  }
}

testVerifyRoute();
