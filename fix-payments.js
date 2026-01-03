const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://gberuashvili92:aegzol2o3jC31sj3@cluster0.hqqyz.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=Cluster0';

async function fixPayments() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('carapp-v2');
    const paymentsCollection = db.collection('payments');
    const subscriptionsCollection = db.collection('subscriptions');
    
    console.log('\n🔍 ვეძებ payment-ებს, სადაც userId "unknown" არის...');
    
    // 1. Payment-ები, სადაც userId "unknown" არის ან არასწორი userId აქვთ
    const paymentsWithUnknownUserId = await paymentsCollection.find({
      $or: [
        { userId: 'unknown' },
        { userId: { $regex: /^\d+$/ } } // userId რომელიც მხოლოდ რიცხვია (recurring payment-ის შეცდომა)
      ],
      $or: [
        { context: 'subscription' },
        { context: 'recurring' }
      ]
    }).toArray();
    
    console.log(`📦 ნაპოვნია ${paymentsWithUnknownUserId.length} payment-ი "unknown" userId-ით`);
    
    for (const payment of paymentsWithUnknownUserId) {
      console.log(`\n🔧 განახლება payment: ${payment._id}`);
      console.log(`   • Order ID: ${payment.orderId}`);
      console.log(`   • External Order ID: ${payment.externalOrderId}`);
      
      // userId-ს externalOrderId-დან გამოვიღოთ
      const externalOrderId = payment.externalOrderId || payment.orderId || '';
      let userId = 'unknown';
      
      // თუ recurring payment-ია, ჯერ parentOrderId-დან ვცდილობთ
      if (payment.parentOrderId) {
        const parentPayment = await paymentsCollection.findOne({
          orderId: payment.parentOrderId
        });
        
        if (parentPayment && parentPayment.userId && parentPayment.userId !== 'unknown') {
          userId = parentPayment.userId;
          console.log(`   ✅ User ID ნაპოვნია parent payment-იდან: ${userId}`);
        }
      }
      
      // თუ ჯერ კიდევ არ ვიცით, externalOrderId-დან ვცდილობთ
      if (userId === 'unknown') {
        const userIdMatch =
          externalOrderId.match(/test_payment_\d+_(.+)/) ||
          externalOrderId.match(/test_subscription_\d+_(.+)/) ||
          externalOrderId.match(/carapp_\d+_(.+)/) ||
          externalOrderId.match(/subscription_\w+_\d+_(.+)/);
        
        if (userIdMatch && userIdMatch[1]) {
          userId = userIdMatch[1];
          console.log(`   ✅ User ID ნაპოვნია externalOrderId-დან: ${userId}`);
        }
      }
      
      // თუ ჯერ კიდევ არ ვიცით
      if (userId === 'unknown') {
        
        // თუ ჯერ კიდევ არ ვიცით, შევამოწმოთ subscription-ში
        if (userId === 'unknown') {
          const subscription = await subscriptionsCollection.findOne({
            $or: [
              { bogCardToken: payment.orderId },
              { orderId: payment.orderId },
              { orderId: payment.parentOrderId }
            ]
          });
          
          if (subscription && subscription.userId) {
            userId = subscription.userId;
            console.log(`   ✅ User ID ნაპოვნია subscription-იდან: ${userId}`);
          }
        }
      }
      
      if (userId !== 'unknown') {
        await paymentsCollection.updateOne(
          { _id: payment._id },
          { $set: { userId: userId } }
        );
        console.log(`   ✅ Payment განახლებულია userId-ით: ${userId}`);
      } else {
        console.log(`   ⚠️ User ID ვერ მოიძებნა`);
      }
    }
    
    console.log('\n🔍 ვეძებ payment-ებს, სადაც metadata-ში plan-ის მონაცემები აკლია...');
    
    // 2. Payment-ები, სადაც metadata-ში plan-ის მონაცემები აკლია
    const paymentsWithoutPlanData = await paymentsCollection.find({
      context: 'subscription',
      $or: [
        { 'metadata.planId': { $exists: false } },
        { 'metadata.planId': null },
        { 'metadata.planPrice': { $exists: false } },
        { 'metadata.planPrice': null }
      ]
    }).toArray();
    
    console.log(`📦 ნაპოვნია ${paymentsWithoutPlanData.length} payment-ი plan-ის მონაცემების გარეშე`);
    
    for (const payment of paymentsWithoutPlanData) {
      console.log(`\n🔧 განახლება payment: ${payment._id}`);
      console.log(`   • User ID: ${payment.userId}`);
      console.log(`   • Order ID: ${payment.orderId}`);
      console.log(`   • Amount: ${payment.amount} ${payment.currency}`);
      
      // subscription-იდან plan-ის მონაცემების მიღება
      let planId, planName, planPrice, planCurrency, planPeriod;
      
      const subscription = await subscriptionsCollection.findOne({
        userId: payment.userId,
        status: 'active'
      });
      
      if (subscription) {
        planId = subscription.planId;
        planName = subscription.planName;
        planPrice = subscription.planPrice?.toString();
        planCurrency = subscription.currency;
        planPeriod = subscription.period;
        
        console.log(`   ✅ Plan მონაცემები ნაპოვნია subscription-იდან:`);
        console.log(`      • Plan ID: ${planId}`);
        console.log(`      • Plan Name: ${planName}`);
        console.log(`      • Plan Price: ${planPrice} ${planCurrency}`);
        console.log(`      • Plan Period: ${planPeriod}`);
      } else {
        // თუ subscription არ არის, გამოვიყენოთ payment-ის მონაცემები
        planPrice = payment.amount?.toString();
        planCurrency = payment.currency;
        planPeriod = 'monthly';
        
        console.log(`   ⚠️ Subscription არ ნაპოვნია, გამოვიყენებთ payment-ის მონაცემებს`);
      }
      
      // metadata-ს განახლება
      const updateData = {
        $set: {
          'metadata.planPrice': planPrice || payment.amount?.toString(),
          'metadata.planCurrency': planCurrency || payment.currency,
          'metadata.planPeriod': planPeriod || 'monthly'
        }
      };
      
      if (planId) {
        updateData.$set['metadata.planId'] = planId;
      }
      
      if (planName) {
        updateData.$set['metadata.planName'] = planName;
      }
      
      await paymentsCollection.updateOne(
        { _id: payment._id },
        updateData
      );
      
      console.log(`   ✅ Payment metadata განახლებულია`);
    }
    
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('✅ Process completed!');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixPayments();

