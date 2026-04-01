const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://gberuashvili123:vhOQ0UhtFUM8S8eg@carappx.lh8hx2q.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=CarappX';

async function checkMechanicsData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔌 Connected to MongoDB');
    
    const db = client.db('carapp-v2');
    
    // Check if mechanics collection exists
    const collections = await db.listCollections().toArray();
    const mechanicsCollection = collections.find(col => col.name === 'mechanics');
    
    if (!mechanicsCollection) {
      console.log('❌ Mechanics collection does not exist');
      return;
    }
    
    console.log('✅ Mechanics collection exists');
    
    // Count documents
    const count = await db.collection('mechanics').countDocuments();
    console.log(`📊 Total mechanics in database: ${count}`);
    
    if (count === 0) {
      console.log('❌ No mechanics found in database');
      return;
    }
    
    // Get sample data
    const sample = await db.collection('mechanics').findOne();
    console.log('📋 Sample mechanic:', {
      _id: sample._id,
      name: sample.name,
      specialty: sample.specialty,
      location: sample.location,
      createdAt: sample.createdAt
    });
    
    // Get all mechanics
    const allMechanics = await db.collection('mechanics').find({}).toArray();
    console.log('📋 All mechanics:');
    allMechanics.forEach((mechanic, index) => {
      console.log(`${index + 1}. ${mechanic.name} - ${mechanic.specialty} (${mechanic.location})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

checkMechanicsData();
