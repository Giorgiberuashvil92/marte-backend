const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://gberuashvili92:aegzol2o3jC31sj3@cluster0.hqqyz.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=Cluster0';

async function createSubscriptionFromPayment() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('carapp-v2');
    const paymentsCollection = db.collection('payments');
    const subscriptionsCollection = db.collection('subscriptions');
    
    const userId = 'test_user_1767303955119';
    
    console.log(`\n🔍 ვეძებ subscription payment-ებს user-ისთვის: ${userId}`);
    
    // ვიღებთ subscription payment-ებს
    const subscriptionPayments = await paymentsCollection.find({
      userId: userId,
      context: 'subscription',
      status: 'completed'
    }).sort({ createdAt: -1 }).toArray();
    
    console.log(`📦 ნაპოვნია ${subscriptionPayments.length} subscription payment-ი`);
    
    for (const payment of subscriptionPayments) {
      console.log(`\n🔧 Processing payment: ${payment._id}`);
      console.log(`   • Order ID: ${payment.orderId}`);
      console.log(`   • Amount: ${payment.amount} ${payment.currency}`);
      console.log(`   • Plan ID: ${payment.metadata?.planId || 'N/A'}`);
      console.log(`   • Plan Name: ${payment.metadata?.planName || 'N/A'}`);
      
      // შევამოწმოთ არსებობს თუ არა subscription
      const existingSubscription = await subscriptionsCollection.findOne({
        userId: userId,
        status: 'active'
      });
      
      if (existingSubscription) {
        console.log(`   ⚠️ Active subscription already exists: ${existingSubscription._id}`);
        console.log(`   • Plan: ${existingSubscription.planId} - ${existingSubscription.planName}`);
        console.log(`   • BOG Token: ${existingSubscription.bogCardToken || 'N/A'}`);
        
        // განვაახლოთ bogCardToken თუ არ აქვს
        if (!existingSubscription.bogCardToken && payment.orderId) {
          await subscriptionsCollection.updateOne(
            { _id: existingSubscription._id },
            { $set: { bogCardToken: payment.orderId } }
          );
          console.log(`   ✅ Updated BOG Token: ${payment.orderId}`);
        }
        continue;
      }
      
      // Plan ID და Plan Name-ის განსაზღვრა
      let planId = payment.metadata?.planId;
      let planName = payment.metadata?.planName;
      
      if (!planId) {
        // Default: basic თუ amount არის 0, premium თუ amount > 0
        planId = payment.amount === 0 ? 'basic' : 'premium';
        console.log(`   📋 Plan ID not found, using default: ${planId}`);
      }
      
      if (!planName) {
        planName = planId === 'basic' ? 'ძირითადი პაკეტი' : 'პრემიუმ პაკეტი';
        console.log(`   📋 Plan Name not found, using default: ${planName}`);
      }
      
      // Period-ის განსაზღვრა metadata-დან
      let period = payment.metadata?.planPeriod || 'monthly';
      if (period.includes('6') || period.includes('6-month')) {
        period = '6months';
      } else if (period.includes('year') || period.includes('წლიანი')) {
        period = 'yearly';
      } else {
        period = 'monthly';
      }
      
      // Next billing date-ის გამოთვლა
      const nextBillingDate = new Date();
      if (period === 'yearly') {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      } else if (period === '6months') {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 6);
      } else {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      }
      
      // Subscription-ის შექმნა
      const subscriptionData = {
        userId: userId,
        planId: planId,
        planName: planName,
        planPrice: payment.amount,
        currency: payment.currency || 'GEL',
        period: period,
        status: 'active',
        startDate: payment.paymentDate || new Date(),
        nextBillingDate: nextBillingDate,
        paymentMethod: 'BOG',
        bogCardToken: payment.orderId, // BOG order_id
        totalPaid: payment.amount,
        billingCycles: 1,
        createdAt: payment.paymentDate || new Date(),
        updatedAt: new Date(),
      };
      
      const result = await subscriptionsCollection.insertOne(subscriptionData);
      console.log(`   ✅ Subscription შეიქმნა: ${result.insertedId}`);
      console.log(`   • Plan: ${planName} (${planId})`);
      console.log(`   • Price: ${payment.amount} ${payment.currency}`);
      console.log(`   • Period: ${period}`);
      console.log(`   • Next Billing: ${nextBillingDate.toISOString()}`);
      console.log(`   • BOG Token: ${payment.orderId}`);
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

createSubscriptionFromPayment();

