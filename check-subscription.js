const { MongoClient, ObjectId } = require('mongodb');

async function checkSubscription() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/carapp');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const sub = await db.collection('subscriptions').findOne({ 
      _id: new ObjectId('694b24bcec3c8494a8351e86') 
    });
    
    if (!sub) {
      console.log('❌ Subscription not found');
      return;
    }
    
    console.log('📊 Subscription Details:');
    console.log(JSON.stringify(sub, null, 2));
    console.log('\n🔍 Field Checks:');
    console.log('  • status:', sub.status);
    console.log('  • nextBillingDate:', sub.nextBillingDate);
    console.log('  • nextBillingDate <= now:', sub.nextBillingDate <= new Date());
    console.log('  • bogCardToken exists:', sub.bogCardToken !== null && sub.bogCardToken !== undefined);
    console.log('  • bogCardToken value:', sub.bogCardToken);
    console.log('  • bogCardToken not null:', sub.bogCardToken !== null);
    
    // Test query
    const now = new Date();
    const query = {
      status: 'active',
      nextBillingDate: { $lte: now },
      bogCardToken: { $exists: true, $ne: null }
    };
    
    console.log('\n🔍 Query:', JSON.stringify(query, null, 2));
    
    const found = await db.collection('subscriptions').find(query).toArray();
    console.log('\n📋 Found subscriptions:', found.length);
    if (found.length > 0) {
      console.log(JSON.stringify(found, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkSubscription();

