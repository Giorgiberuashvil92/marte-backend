// Manual test script for recurring payments
const fetch = require('node-fetch');

async function testRecurringPayments() {
  try {
    console.log('🔄 Testing manual recurring payments...');
    
    const response = await fetch('http://localhost:3000/api/recurring-payments/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Recurring payments processed successfully!');
      console.log(`   • Total: ${result.data.total}`);
      console.log(`   • Success: ${result.data.success}`);
      console.log(`   • Failed: ${result.data.failed}`);
    } else {
      console.log('❌ Recurring payments failed:', result.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testRecurringPayments();

