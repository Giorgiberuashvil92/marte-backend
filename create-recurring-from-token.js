const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection string - იგივე რაც backend-ში
const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://gberuashvili123:vhOQ0UhtFUM8S8eg@carappx.lh8hx2q.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=CarappX';

async function createRecurringFromToken() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('carapp-v2');
    const paymentsCollection = db.collection('payments');
    const subscriptionsCollection = db.collection('subscriptions');
    
    // ვპოულობთ payment-ებს რომლებსაც აქვთ paymentToken მაგრამ არ აქვთ subscription
    const paymentsWithToken = await paymentsCollection
      .find({
        paymentToken: { $exists: true, $ne: null },
        status: 'completed',
      })
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 PAYMENTS WITH TOKEN (სულ: ${paymentsWithToken.length})`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (paymentsWithToken.length === 0) {
      console.log('⚠️ Payment-ები token-ით არ მოიძებნა');
      return;
    }
    
    for (const payment of paymentsWithToken) {
      console.log(`\n📋 Payment ID: ${payment._id}`);
      console.log(`   • User ID: ${payment.userId}`);
      console.log(`   • Order ID: ${payment.orderId}`);
      console.log(`   • Payment Token: ${payment.paymentToken}`);
      console.log(`   • Amount: ${payment.amount} ${payment.currency}`);
      console.log(`   • Context: ${payment.context}`);
      
      // ვამოწმებთ არსებობს თუ არა subscription ამ user-ისთვის ამ token-ით
      const existingSubscription = await subscriptionsCollection.findOne({
        userId: payment.userId,
        bogCardToken: payment.paymentToken,
      });
      
      if (existingSubscription) {
        console.log(`   ⚠️ Subscription უკვე არსებობს: ${existingSubscription._id}`);
        console.log(`   • Status: ${existingSubscription.status}`);
        console.log(`   • Next Billing: ${existingSubscription.nextBillingDate ? new Date(existingSubscription.nextBillingDate).toISOString() : 'N/A'}`);
      } else {
        console.log(`   🔄 შევქმნათ subscription...`);
        
        // შევქმნათ subscription
        const subscriptionData = {
          userId: payment.userId,
          planId: payment.context === 'test' ? 'test_plan' : 'subscription_plan',
          planName: payment.context === 'test' ? 'ტესტ საბსქრიფშენი' : 'პრემიუმ საბსქრიფშენი',
          planPrice: payment.amount,
          currency: payment.currency || 'GEL',
          period: 'monthly',
          status: 'active',
          startDate: new Date(),
          nextBillingDate: calculateNextBillingDate('monthly', new Date()),
          paymentMethod: 'BOG',
          bogCardToken: payment.paymentToken,
          totalPaid: payment.amount,
          billingCycles: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const result = await subscriptionsCollection.insertOne(subscriptionData);
        console.log(`   ✅ Subscription შეიქმნა: ${result.insertedId}`);
        console.log(`   • Plan: ${subscriptionData.planName}`);
        console.log(`   • Price: ${subscriptionData.planPrice} ${subscriptionData.currency}`);
        console.log(`   • Next Billing: ${subscriptionData.nextBillingDate.toISOString()}`);
      }
      
      console.log('   ───────────────────────────────────────────────');
    }
    
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('✅ Process completed!');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('✅ MongoDB connection closed');
  }
}

function calculateNextBillingDate(period, currentDate) {
  const nextDate = new Date(currentDate);
  
  switch (period) {
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
  }
  
  return nextDate;
}

createRecurringFromToken();

