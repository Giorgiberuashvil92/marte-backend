const { MongoClient } = require('mongodb');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://gberuashvili123:vhOQ0UhtFUM8S8eg@carappx.lh8hx2q.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=CarappX';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

/**
 * Test Recurring Payments სისტემა
 * 
 * ეს სკრიპტი:
 * 1. ქმნის test subscription-ს
 * 2. ამოწმებს recurring payment endpoints-ებს
 * 3. ამოწმებს manual trigger-ს
 */

async function testRecurringPayments() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('🔌 Connected to MongoDB\n');

    const db = client.db('carapp-v2');
    const subscriptionsCollection = db.collection('subscriptions');
    const paymentsCollection = db.collection('payments');

    // Test user ID (შეგიძლია შეცვალო)
    const testUserId = 'test_user_recurring_' + Date.now();
    const testPlanId = 'premium_monthly';

    console.log('📋 Test Recurring Payments სისტემა\n');
    console.log('='.repeat(50));

    // 1. Test Subscription-ის შექმნა
    console.log('\n1️⃣ Test Subscription-ის შექმნა...');
    
    // nextBillingDate დავსეტოთ წარსულში, რომ cron job-მა მაშინვე იპოვოს
    const nextBillingDate = new Date();
    nextBillingDate.setHours(nextBillingDate.getHours() - 1); // 1 საათის წინ

    const testSubscription = {
      userId: testUserId,
      planId: testPlanId,
      planName: 'Premium Plan',
      planPrice: 50.0,
      currency: 'GEL',
      period: 'monthly',
      status: 'active',
      startDate: new Date(),
      nextBillingDate: nextBillingDate, // წარსულში, რომ cron job-მა იპოვოს
      paymentMethod: 'BOG',
      bogCardToken: 'test_order_id_12345', // Test BOG order_id (წარმატებული გადახდის)
      billingCycles: 0,
      totalPaid: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // წავშალოთ ძველი test subscription-ები
    await subscriptionsCollection.deleteMany({
      userId: testUserId,
    });

    const subscriptionResult = await subscriptionsCollection.insertOne(
      testSubscription,
    );
    const subscriptionId = subscriptionResult.insertedId.toString();

    console.log('✅ Test Subscription შეიქმნა:');
    console.log(`   Subscription ID: ${subscriptionId}`);
    console.log(`   User ID: ${testUserId}`);
    console.log(`   Plan: ${testSubscription.planName} - ${testSubscription.planPrice}₾`);
    console.log(`   Next Billing Date: ${nextBillingDate.toISOString()}`);
    console.log(`   BOG Token: ${testSubscription.bogCardToken}`);

    // 2. API Endpoints-ების ტესტირება
    console.log('\n2️⃣ API Endpoints-ების ტესტირება...\n');

    // 2.1. Recurring Payments Status
    console.log('📊 Recurring Payments Status:');
    try {
      const statusResponse = await fetch(`${API_BASE_URL}/api/recurring-payments/status`);
      const statusData = await statusResponse.json();
      console.log('   ✅ Status:', JSON.stringify(statusData, null, 2));
    } catch (error) {
      console.log('   ❌ Error:', error.message);
    }

    // 2.2. Manual Trigger (ტესტირებისთვის)
    console.log('\n🔄 Manual Recurring Payments Trigger:');
    try {
      const processResponse = await fetch(`${API_BASE_URL}/api/recurring-payments/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const processData = await processResponse.json();
      console.log('   ✅ Response:', JSON.stringify(processData, null, 2));
    } catch (error) {
      console.log('   ❌ Error:', error.message);
    }

    // 2.3. BOG Recurring Payment Token-ის მიღება
    console.log('\n🔑 BOG Recurring Payment Token:');
    try {
      const tokenResponse = await fetch(
        `${API_BASE_URL}/bog/recurring-payment-token/${testSubscription.bogCardToken}`,
      );
      const tokenData = await tokenResponse.json();
      console.log('   ✅ Token:', JSON.stringify(tokenData, null, 2));
    } catch (error) {
      console.log('   ❌ Error:', error.message);
    }

    // 2.4. BOG Recurring Payment (სატესტოდ)
    console.log('\n💳 BOG Recurring Payment (სატესტოდ):');
    console.log('   ⚠️  ეს endpoint BOG API-ს იყენებს - მხოლოდ production-ში იმუშავებს');
    console.log('   📝 Test Data:');
    console.log('      order_id:', testSubscription.bogCardToken);
    console.log('      amount:', testSubscription.planPrice);
    console.log('      shop_order_id: recurring_test_' + Date.now());
    
    // 3. Subscription-ის შემოწმება
    console.log('\n3️⃣ Subscription-ის შემოწმება...');
    const updatedSubscription = await subscriptionsCollection.findOne({
      _id: subscriptionResult.insertedId,
    });

    if (updatedSubscription) {
      console.log('   ✅ Subscription ნაპოვნია:');
      console.log(`      Status: ${updatedSubscription.status}`);
      console.log(`      Billing Cycles: ${updatedSubscription.billingCycles}`);
      console.log(`      Total Paid: ${updatedSubscription.totalPaid}₾`);
      console.log(`      Next Billing Date: ${updatedSubscription.nextBillingDate?.toISOString() || 'N/A'}`);
    }

    // 4. Payment-ების შემოწმება
    console.log('\n4️⃣ Payment-ების შემოწმება...');
    const payments = await paymentsCollection
      .find({
        userId: testUserId,
        context: 'subscription',
      })
      .sort({ paymentDate: -1 })
      .limit(5)
      .toArray();

    console.log(`   📊 ნაპოვნია ${payments.length} payment:`);
    payments.forEach((payment, index) => {
      console.log(`   ${index + 1}. ${payment.amount}₾ - ${payment.status} - ${payment.paymentDate}`);
    });

    // 5. ინსტრუქციები
    console.log('\n' + '='.repeat(50));
    console.log('\n📚 როგორ გამოიყენო:\n');
    console.log('1. Manual Trigger (ტესტირებისთვის):');
    console.log(`   POST ${API_BASE_URL}/api/recurring-payments/process\n`);
    console.log('2. Cron Job Status:');
    console.log(`   GET ${API_BASE_URL}/api/recurring-payments/status\n`);
    console.log('3. BOG Recurring Payment:');
    console.log(`   POST ${API_BASE_URL}/bog/recurring-payment`);
    console.log('   Body: {');
    console.log('     "order_id": "წარმატებული_გადახდის_order_id",');
    console.log('     "amount": 50.00,');
    console.log('     "currency": "GEL",');
    console.log('     "shop_order_id": "recurring_123",');
    console.log('     "purchase_description": "Monthly subscription"');
    console.log('   }\n');
    console.log('4. Cron Job:');
    console.log('   - გაშვება: ყოველ საათში ერთხელ');
    console.log('   - Timezone: Asia/Tbilisi');
    console.log('   - შეგიძლია შეცვალო recurring-payments.service.ts-ში\n');

    console.log('✅ ტესტირება დასრულდა!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the test
testRecurringPayments();

