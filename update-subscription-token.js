const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection string - იგივე რაც backend-ში
const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://gberuashvili123:vhOQ0UhtFUM8S8eg@carappx.lh8hx2q.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=CarappX';

async function updateSubscriptionToken(newOrderId, userId) {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('carapp-v2');
    const subscriptionsCollection = db.collection('subscriptions');
    
    // ვპოულობთ subscription-ს user-ის მიხედვით
    const query = userId 
      ? { userId: userId, status: 'active' }
      : { status: 'active' };
    
    const subscription = await subscriptionsCollection.findOne(query);
    
    if (!subscription) {
      console.log('❌ Active subscription არ მოიძებნა');
      return;
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 SUBSCRIPTION FOUND:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   • Subscription ID: ${subscription._id}`);
    console.log(`   • User ID: ${subscription.userId}`);
    console.log(`   • Old Token: ${subscription.bogCardToken}`);
    console.log(`   • New Token: ${newOrderId}`);
    console.log(`   • Next Billing Date (old): ${subscription.nextBillingDate ? new Date(subscription.nextBillingDate).toISOString() : 'N/A'}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // განვაახლოთ subscription-ის bogCardToken და nextBillingDate (წარსულში)
    const pastDate = new Date();
    pastDate.setMinutes(pastDate.getMinutes() - 5); // 5 წუთით წინ
    
    const updateResult = await subscriptionsCollection.updateOne(
      { _id: subscription._id },
      {
        $set: {
          bogCardToken: newOrderId,
          nextBillingDate: pastDate,
          updatedAt: new Date(),
        },
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log('✅ Subscription განახლებულია!');
      console.log(`   • New Token: ${newOrderId}`);
      console.log(`   • New Next Billing Date: ${pastDate.toISOString()}`);
      console.log('═══════════════════════════════════════════════════════\n');
    } else {
      console.log('⚠️ Subscription არ განახლებულა');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('✅ MongoDB connection closed');
  }
}

// Command line argument-იდან new order ID
const newOrderId = process.argv[2];
const userId = process.argv[3]; // Optional: specific user ID

if (!newOrderId) {
  console.log('📋 Usage: node update-subscription-token.js <new_order_id> [user_id]');
  console.log('\n💡 Example:');
  console.log('   node update-subscription-token.js 04bc4a16-e2fa-4152-8195-2b56f3d68d94');
  console.log('   node update-subscription-token.js 04bc4a16-e2fa-4152-8195-2b56f3d68d94 usr_1766388727508');
  process.exit(1);
}

updateSubscriptionToken(newOrderId, userId);

