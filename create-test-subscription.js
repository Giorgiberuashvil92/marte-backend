const { MongoClient } = require('mongodb');

// MongoDB connection string - იგივე რაც backend-ში
const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://gberuashvili92:aegzol2o3jC31sj3@cluster0.hqqyz.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=Cluster0';

async function createTestSubscription() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const subscriptionsCollection = db.collection('subscriptions');

    // Test subscription data
    const subscriptionData = {
      userId: 'usr_1766388727508',
      planId: 'test_plan',
      planName: 'ტესტ საბსქრიფშენი',
      planPrice: 1,
      currency: 'GEL',
      period: 'monthly',
      status: 'active',
      startDate: new Date(),
      nextBillingDate: new Date(Date.now() - 60 * 1000), // 1 წუთის წინ (ტესტირებისთვის - დაუყოვნებლივ დასამუშავებლად)
      paymentMethod: 'BOG',
      bogCardToken: '3108bd8a-2f3d-403e-a3d2-2e26b9e7d678', // Payment token
      totalPaid: 1,
      billingCycles: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // ვამოწმებთ არსებობს თუ არა subscription
    const existingSubscription = await subscriptionsCollection.findOne({
      userId: subscriptionData.userId,
      status: 'active',
    });

    if (existingSubscription) {
      console.log('⚠️ Active subscription already exists, updating...');
      const result = await subscriptionsCollection.updateOne(
        { _id: existingSubscription._id },
        {
          $set: {
            ...subscriptionData,
            _id: existingSubscription._id, // Keep existing _id
          },
        },
      );
      console.log('✅ Subscription updated:', result.modifiedCount > 0);
      console.log('📋 Subscription ID:', existingSubscription._id);
    } else {
      const result = await subscriptionsCollection.insertOne(subscriptionData);
      console.log('✅ Subscription created successfully!');
      console.log('📋 Subscription ID:', result.insertedId);
    }

    // ვაჩვენებთ subscription-ს
    const subscription = await subscriptionsCollection.findOne({
      userId: subscriptionData.userId,
    });

    console.log('\n📊 Subscription Details:');
    console.log(JSON.stringify(subscription, null, 2));
    console.log('\n⏰ Next Billing Date:', subscription.nextBillingDate);
    console.log(
      '⏰ Time until next billing:',
      Math.round((subscription.nextBillingDate - new Date()) / 1000),
      'seconds',
    );
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

createTestSubscription();

