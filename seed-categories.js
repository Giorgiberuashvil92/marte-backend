const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://gberuashvili123:vhOQ0UhtFUM8S8eg@carappx.lh8hx2q.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=CarappX';

// საწყისი კატეგორიები
const DEFAULT_CATEGORIES = [
  {
    name: 'სამრეცხაო სერვისები',
    nameEn: 'Carwash Services',
    description: 'ავტომობილის სამრეცხაო სერვისები და ბუქინგი',
    icon: 'water',
    color: '#22C55E',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1000',
    isActive: true,
    order: 1,
    serviceTypes: ['carwash'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'ავტოსერვისები',
    nameEn: 'Auto Services',
    description: 'ავტომობილის სერვისი და რემონტი',
    icon: 'construct',
    color: '#3B82F6',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 2,
    serviceTypes: ['mechanic'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'ავტო მაღაზიები',
    nameEn: 'Auto Stores',
    description: 'ავტომობილის აქსესუარები და ნაწილები',
    icon: 'storefront',
    color: '#F59E0B',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 3,
    serviceTypes: ['store'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'დაშლილი მანქანები',
    nameEn: 'Dismantled Cars',
    description: 'დაშლილი მანქანების ნაწილები',
    icon: 'build',
    color: '#6366F1',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 4,
    serviceTypes: ['dismantler'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'ავტონაწილები',
    nameEn: 'Auto Parts',
    description: 'ავტომობილის ნაწილები და აქსესუარები',
    icon: 'cog',
    color: '#EC4899',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 5,
    serviceTypes: ['part'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'პარკინგები',
    nameEn: 'Parking',
    description: 'ავტომობილის პარკინგი',
    icon: 'car',
    color: '#8B5CF6',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 6,
    serviceTypes: ['parking'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'დაზღვევა',
    nameEn: 'Insurance',
    description: 'ავტომობილის დაზღვევა',
    icon: 'shield-checkmark',
    color: '#10B981',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 7,
    serviceTypes: ['insurance'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'მანქანის გაქირავება',
    nameEn: 'Car Rental',
    description: 'მანქანის ქირაობა',
    icon: 'key',
    color: '#F97316',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 8,
    serviceTypes: ['rental'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Parts-ის ქვეკატეგორიები
const PARTS_SUBCATEGORIES = [
  {
    name: 'ძრავა',
    nameEn: 'Engine',
    description: 'ძრავის ნაწილები',
    icon: 'settings',
    color: '#EF4444',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 1,
    serviceTypes: ['part'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'ტრანსმისია',
    nameEn: 'Transmission',
    description: 'ტრანსმისიის ნაწილები',
    icon: 'cog',
    color: '#F59E0B',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 2,
    serviceTypes: ['part'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'ფარები',
    nameEn: 'Body Parts',
    description: 'ფარების ნაწილები',
    icon: 'car-sport',
    color: '#3B82F6',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 3,
    serviceTypes: ['part'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'საბურავები',
    nameEn: 'Tires',
    description: 'საბურავები და დისკები',
    icon: 'disc',
    color: '#10B981',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 4,
    serviceTypes: ['part'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'ბლოკ-ფარები',
    nameEn: 'Bumpers',
    description: 'ბლოკ-ფარები და ფარების ნაწილები',
    icon: 'shield',
    color: '#6366F1',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 5,
    serviceTypes: ['part'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'ინტერიერი',
    nameEn: 'Interior',
    description: 'ინტერიერის ნაწილები',
    icon: 'car-sport',
    color: '#8B5CF6',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 6,
    serviceTypes: ['part'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'ელექტრონიკა',
    nameEn: 'Electronics',
    description: 'ელექტრონული ნაწილები',
    icon: 'flash',
    color: '#EC4899',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 7,
    serviceTypes: ['part'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'სხვა',
    nameEn: 'Other',
    description: 'სხვა ნაწილები',
    icon: 'grid',
    color: '#6B7280',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1000',
    isActive: true,
    order: 8,
    serviceTypes: ['part'],
    popularity: 0,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

async function seedCategories() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔌 Connected to MongoDB');
    
    const db = client.db('carapp-v2');
    const categoriesCollection = db.collection('categories');
    
    console.log('🌱 Seeding categories...');
    
    // Check if categories already exist
    const existingCount = await categoriesCollection.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing categories`);
      const shouldOverwrite = process.argv.includes('--overwrite');
      if (!shouldOverwrite) {
        console.log('ℹ️  Use --overwrite flag to replace existing categories');
        console.log('📝 Adding new categories only (skipping duplicates)...');
        
        // Insert only new categories (by name)
        for (const category of [...DEFAULT_CATEGORIES, ...PARTS_SUBCATEGORIES]) {
          const existing = await categoriesCollection.findOne({ name: category.name });
          if (!existing) {
            await categoriesCollection.insertOne(category);
            console.log(`✅ Added new category: ${category.name}`);
          } else {
            console.log(`⏭️  Skipped existing category: ${category.name}`);
          }
        }
        
        await client.close();
        console.log('🔌 MongoDB connection closed');
        return;
      } else {
        console.log('🗑️  Removing existing categories...');
        await categoriesCollection.deleteMany({});
      }
    }
    
    // Insert main categories
    console.log('📦 Inserting main categories...');
    const mainCategoriesResult = await categoriesCollection.insertMany(DEFAULT_CATEGORIES);
    console.log(`✅ Inserted ${mainCategoriesResult.insertedCount} main categories`);
    
    // Find the parts category to use as parent
    const partsCategory = await categoriesCollection.findOne({ 
      name: 'ავტონაწილები' 
    });
    
    // Insert parts subcategories with parentId
    console.log('📦 Inserting parts subcategories...');
    const partsSubcategories = PARTS_SUBCATEGORIES.map(cat => ({
      ...cat,
      parentId: partsCategory?._id?.toString(),
    }));
    
    const subcategoriesResult = await categoriesCollection.insertMany(partsSubcategories);
    console.log(`✅ Inserted ${subcategoriesResult.insertedCount} parts subcategories`);
    
    const totalCount = await categoriesCollection.countDocuments();
    console.log(`🎉 Successfully seeded ${totalCount} categories!`);
    console.log('\n📋 Categories created:');
    console.log('   Main categories:', DEFAULT_CATEGORIES.length);
    console.log('   Parts subcategories:', PARTS_SUBCATEGORIES.length);
    
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the seed function
seedCategories();


