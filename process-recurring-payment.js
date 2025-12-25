const fetch = require('node-fetch');

// Backend URL
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

async function processRecurringPayment(paymentToken) {
  try {
    console.log('🔄 Recurring Payment-ის განხორციელება...');
    console.log(`   • Payment Token: ${paymentToken}`);
    console.log(`   • Backend URL: ${BACKEND_URL}\n`);
    
    // 1. ვპოულობთ payment-ს token-ით (orderId = paymentToken)
    const paymentResponse = await fetch(`${BACKEND_URL}/api/payments/order/${paymentToken}`);
    const paymentData = await paymentResponse.json();
    
    if (!paymentData.success || !paymentData.data) {
      console.log('❌ Payment არ მოიძებნა token-ით:', paymentToken);
      return;
    }
    
    const payment = paymentData.data;
    console.log('✅ Payment ნაპოვნია:');
    console.log(`   • Payment ID: ${payment._id}`);
    console.log(`   • User ID: ${payment.userId}`);
    console.log(`   • Amount: ${payment.amount} ${payment.currency}`);
    console.log(`   • Order ID: ${payment.orderId}\n`);
    
    // 2. ვპოულობთ subscription-ს token-ით
    const subscriptionsResponse = await fetch(`${BACKEND_URL}/subscriptions`);
    const subscriptionsData = await subscriptionsResponse.json();
    const subscriptions = Array.isArray(subscriptionsData) ? subscriptionsData : [];
    
    console.log(`📊 Found ${subscriptions.length} subscriptions`);
    
    const subscription = subscriptions.find(
      (sub) => sub.bogCardToken === paymentToken && sub.status === 'active'
    );
    
    if (!subscription) {
      console.log('⚠️ Active subscription არ მოიძებნა token-ით');
      console.log('💡 გამოიყენე: npm run create:recurring-from-token');
      return;
    }
    
    console.log('✅ Subscription ნაპოვნია:');
    console.log(`   • Subscription ID: ${subscription._id}`);
    console.log(`   • Plan: ${subscription.planName}`);
    console.log(`   • Price: ${subscription.planPrice} ${subscription.currency}`);
    console.log(`   • Next Billing: ${subscription.nextBillingDate}\n`);
    
    // 3. განახორციელებს recurring payment-ს
    console.log('🔄 Recurring Payment-ის განხორციელება...');
    const recurringResponse = await fetch(`${BACKEND_URL}/api/recurring-payments/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const recurringData = await recurringResponse.json();
    
    if (recurringData.success) {
      console.log('✅ Recurring Payment წარმატებით განხორციელდა!');
      console.log(`   • Total: ${recurringData.data.total}`);
      console.log(`   • Success: ${recurringData.data.success}`);
      console.log(`   • Failed: ${recurringData.data.failed}`);
    } else {
      console.log('❌ Recurring Payment ვერ მოხერხდა:', recurringData.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Command line argument-იდან payment token
const paymentToken = process.argv[2];

if (!paymentToken) {
  console.log('📋 Usage: npm run process:recurring <payment_token>');
  console.log('   ან: node process-recurring-payment.js <payment_token>');
  console.log('\n💡 Example:');
  console.log('   npm run process:recurring 3108bd8a-2f3d-403e-a3d2-2e26b9e7d678');
  process.exit(1);
}

processRecurringPayment(paymentToken);

