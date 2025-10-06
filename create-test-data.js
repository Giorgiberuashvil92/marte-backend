const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://gberuashvili92:aegzol2o3jC31sj3@cluster0.hqqyz.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=Cluster0';

async function createTestData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔌 Connected to MongoDB');
    
    const db = client.db('carapp-v2');
    const userId = 'usr_1759151287420';
    
    console.log('🧪 Creating fresh test data...');
    
    // Clean existing test data
    await db.collection('requests').deleteMany({ userId: userId });
    await db.collection('offers').deleteMany({ userId: userId });
    console.log('🧹 Cleaned existing test data');
    
    // Create test request
    const testRequest = {
      userId: userId,
      category: 'ნაწილები',
      description: 'შევეძლო ნაწილები ვიპოვო BMW X5-ისთვის?',
      location: 'თბილისი, ვაკე',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const requestResult = await db.collection('requests').insertOne(testRequest);
    const requestId = requestResult.insertedId.toString();
    console.log('✅ Created test request:', requestId);
    
    // Create test offer
    const testOffer = {
      reqId: requestId,
      userId: userId,
      partnerId: userId, // Same user as partner for testing
      providerName: 'გიოს დაშლილების მაღაზია',
      priceGEL: 250,
      etaMin: 15,
      distanceKm: 2.5,
      description: 'ყველა ნაწილი გვაქვს BMW X5-ისთვის',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const offerResult = await db.collection('offers').insertOne(testOffer);
    console.log('✅ Created test offer:', offerResult.insertedId.toString());
    
    // Create test messages
    const testMessages = [
      {
        requestId: requestId,
        sender: 'user',
        senderId: userId,
        receiverId: userId,
        message: 'გამარჯობა! ვეძებ BMW X5-ის ნაწილებს',
        timestamp: Date.now() - 300000, // 5 minutes ago
        isRead: false
      },
      {
        requestId: requestId,
        sender: 'partner',
        senderId: userId,
        receiverId: userId,
        message: 'გამარჯობა! რა ნაწილები გჭირდება?',
        timestamp: Date.now() - 240000, // 4 minutes ago
        isRead: false
      }
    ];
    
    await db.collection('messages').insertMany(testMessages);
    console.log('✅ Created test messages');
    
    console.log('🎉 Test data created successfully!');
    console.log('📱 Now you can test the full chat flow:');
    console.log(`   - Request ID: ${requestId}`);
    console.log(`   - User ID: ${userId}`);
    console.log(`   - Partner ID: ${userId}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

createTestData();
