const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://gberuashvili92:aegzol2o3jC31sj3@cluster0.hqqyz.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=Cluster0';

async function setupDevelopmentData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔌 Connected to MongoDB');
    
    const db = client.db('carapp-v2');
    
    // Get current user ID
    const userId = 'usr_1759151287420';
    console.log('👤 Setting up development data for user:', userId);
    
    // 1. Update all offers to use real userId as partnerId
    const offersResult = await db.collection('offers').updateMany(
      { userId: userId },
      { 
        $set: { 
          partnerId: userId,
          updatedAt: Date.now()
        }
      }
    );
    console.log(`✅ Updated ${offersResult.modifiedCount} offers with correct partnerId`);
    
    // 2. Update all dismantlers to use real userId as ownerId
    const dismantlersResult = await db.collection('dismantlers').updateMany(
      { ownerId: 'demo-user' },
      { 
        $set: { 
          ownerId: userId,
          updatedAt: Date.now()
        }
      }
    );
    console.log(`✅ Updated ${dismantlersResult.modifiedCount} dismantlers with correct ownerId`);
    
    // 3. Create test request if none exists
    const existingRequest = await db.collection('requests').findOne({ userId: userId });
    if (!existingRequest) {
      const testRequest = {
        userId: userId,
        category: 'ნაწილები',
        description: 'Test request for development',
        location: 'თბილისი',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await db.collection('requests').insertOne(testRequest);
      console.log('✅ Created test request');
    } else {
      console.log('✅ Test request already exists');
    }
    
    // 4. Create test offer if none exists
    const existingOffer = await db.collection('offers').findOne({ userId: userId });
    if (!existingOffer) {
      const requests = await db.collection('requests').find({ userId: userId }).toArray();
      if (requests.length > 0) {
        const testOffer = {
          reqId: requests[0]._id.toString(),
          userId: userId,
          partnerId: userId, // Same user as partner
          providerName: 'Test Partner',
          priceGEL: 100,
          etaMin: 30,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await db.collection('offers').insertOne(testOffer);
        console.log('✅ Created test offer');
      }
    } else {
      console.log('✅ Test offer already exists');
    }
    
    console.log('🎉 Development setup complete!');
    console.log('📱 Now you can test:');
    console.log('   - AI page should show dismantler card');
    console.log('   - Partner chats should show offers');
    console.log('   - Chat should work between user and partner');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

setupDevelopmentData();
