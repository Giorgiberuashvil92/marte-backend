const mongoose = require('mongoose');

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://gberuashvili123:vhOQ0UhtFUM8S8eg@carappx.lh8hx2q.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=CarappX';

// Car Rental Schema (simplified for seeding)
const CarRentalSchema = new mongoose.Schema({
  brand: String,
  model: String,
  year: Number,
  category: String,
  pricePerDay: Number,
  pricePerWeek: Number,
  pricePerMonth: Number,
  images: [String],
  description: String,
  features: [String],
  transmission: String,
  fuelType: String,
  seats: Number,
  location: String,
  address: String,
  phone: String,
  email: String,
  available: Boolean,
  rating: Number,
  reviews: Number,
  totalBookings: Number,
  deposit: Number,
  minRentalDays: Number,
  maxRentalDays: Number,
  extras: {
    childSeat: Number,
    additionalDriver: Number,
    navigation: Number,
    insurance: Number,
  },
  isActive: Boolean,
  views: Number,
  createdAt: Date,
  updatedAt: Date,
});

const CarRental = mongoose.model('CarRental', CarRentalSchema);

// Sample rental cars data
const rentalCars = [
  {
    brand: 'Toyota',
    model: 'Camry',
    year: 2023,
    category: 'კომფორტი',
    pricePerDay: 150,
    pricePerWeek: 900,
    pricePerMonth: 3500,
    images: [
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800',
      'https://images.unsplash.com/photo-1619405399517-d7fce0f13302?w=800',
    ],
    description: 'სანდო და კომფორტული Toyota Camry 2023 წლის მოდელი. იდეალურია ოჯახებისა და ბიზნეს მგზავრობისთვის. ეკონომიური ჰიბრიდული ძრავით.',
    features: ['GPS ნავიგაცია', 'Bluetooth', 'კონდიციონერი', 'ნახევრად ავტომატური', 'უსადენო დამუხტვა', 'ჰიბრიდი'],
    transmission: 'ავტომატიკა',
    fuelType: 'ჰიბრიდი',
    seats: 5,
    location: 'თბილისი',
    address: 'ვაჟა-ფშაველას გამზირი 53',
    phone: '+995 555 123 456',
    email: 'info@carrental.ge',
    available: true,
    rating: 4.8,
    reviews: 124,
    totalBookings: 48,
    deposit: 100,
    minRentalDays: 1,
    maxRentalDays: 30,
    extras: {
      childSeat: 10,
      additionalDriver: 15,
      navigation: 5,
      insurance: 20,
    },
    isActive: true,
    views: 256,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    brand: 'Mercedes-Benz',
    model: 'E-Class',
    year: 2024,
    category: 'ლუქსი',
    pricePerDay: 300,
    pricePerWeek: 1800,
    pricePerMonth: 7000,
    images: [
      'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800',
      'https://images.unsplash.com/photo-1617531653520-bd466e4d1c46?w=800',
    ],
    description: 'პრესტიჟული Mercedes E-Class 2024 წლის მოდელი. მაქსიმალური კომფორტი და ლუქსი. ყველა თანამედროვე ტექნოლოგიით აღჭურვილი.',
    features: ['GPS ნავიგაცია', 'Bluetooth', 'ნაჰის სავარძლები', 'პანორამული სახურავი', 'Massage Seats', 'Premium Audio', 'ავტოპილოტი'],
    transmission: 'ავტომატიკა',
    fuelType: 'დიზელი',
    seats: 5,
    location: 'თბილისი',
    address: 'ჭავჭავაძის გამზირი 33',
    phone: '+995 555 234 567',
    email: 'luxury@carrental.ge',
    available: true,
    rating: 4.9,
    reviews: 98,
    totalBookings: 42,
    deposit: 200,
    minRentalDays: 2,
    maxRentalDays: 30,
    extras: {
      childSeat: 15,
      additionalDriver: 20,
      navigation: 0,
      insurance: 30,
    },
    isActive: true,
    views: 412,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    brand: 'BMW',
    model: 'X5',
    year: 2023,
    category: 'SUV',
    pricePerDay: 280,
    pricePerWeek: 1680,
    pricePerMonth: 6500,
    images: [
      'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800',
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800',
    ],
    description: 'ძლიერი და ელეგანტური BMW X5. 4x4 სისტემით, იდეალურია მთაში მოგზაურობისთვის. 7 ადგილიანი, ოჯახებისთვის შესანიშნავი არჩევანი.',
    features: ['GPS ნავიგაცია', 'Bluetooth', '4WD', 'Parking Sensors', '7 ადგილი', 'Apple CarPlay', 'ხმის მართვა'],
    transmission: 'ავტომატიკა',
    fuelType: 'ბენზინი',
    seats: 7,
    location: 'თბილისი',
    address: 'აღმაშენებლის გამზირი 128',
    phone: '+995 555 345 678',
    email: 'suv@carrental.ge',
    available: true,
    rating: 4.7,
    reviews: 76,
    totalBookings: 35,
    deposit: 150,
    minRentalDays: 1,
    maxRentalDays: 30,
    extras: {
      childSeat: 12,
      additionalDriver: 18,
      navigation: 0,
      insurance: 25,
    },
    isActive: true,
    views: 328,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    brand: 'Hyundai',
    model: 'Elantra',
    year: 2022,
    category: 'ეკონომი',
    pricePerDay: 100,
    pricePerWeek: 600,
    pricePerMonth: 2300,
    images: [
      'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800',
    ],
    description: 'ეკონომიური და საიმედო Hyundai Elantra. შესანიშნავი არჩევანია ყოველდღიური გადაადგილებისთვის. დაბალი საწვავის მოხმარება.',
    features: ['Bluetooth', 'კონდიციონერი', 'AUX/USB', 'ბექინგ კამერა'],
    transmission: 'მექანიკა',
    fuelType: 'ბენზინი',
    seats: 5,
    location: 'თბილისი',
    address: 'წერეთლის გამზირი 89',
    phone: '+995 555 456 789',
    email: 'budget@carrental.ge',
    available: true,
    rating: 4.5,
    reviews: 142,
    totalBookings: 67,
    deposit: 50,
    minRentalDays: 1,
    maxRentalDays: 30,
    extras: {
      childSeat: 8,
      additionalDriver: 10,
      navigation: 10,
      insurance: 15,
    },
    isActive: true,
    views: 445,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    brand: 'Volkswagen',
    model: 'Transporter',
    year: 2023,
    category: 'მინივენი',
    pricePerDay: 200,
    pricePerWeek: 1200,
    pricePerMonth: 4500,
    images: [
      'https://images.unsplash.com/photo-1527786356703-4b100091cd2c?w=800',
    ],
    description: 'ფართო VW Transporter მინივენი 9 ადგილით. იდეალურია დიდი ჯგუფებისთვის, ოჯახებისთვის და ტურისტული მოგზაურობებისთვის.',
    features: ['GPS ნავიგაცია', 'Bluetooth', 'კონდიციონერი', '9 ადგილი', 'დიდი ბარგის სივრცე', 'Cruise Control'],
    transmission: 'მექანიკა',
    fuelType: 'დიზელი',
    seats: 9,
    location: 'თბილისი',
    address: 'თავისუფლების მოედანი 2',
    phone: '+995 555 567 890',
    email: 'van@carrental.ge',
    available: true,
    rating: 4.6,
    reviews: 58,
    totalBookings: 29,
    deposit: 120,
    minRentalDays: 2,
    maxRentalDays: 30,
    extras: {
      childSeat: 10,
      additionalDriver: 15,
      navigation: 5,
      insurance: 20,
    },
    isActive: true,
    views: 187,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    brand: 'Audi',
    model: 'A6',
    year: 2024,
    category: 'ლუქსი',
    pricePerDay: 320,
    pricePerWeek: 1920,
    pricePerMonth: 7500,
    images: [
      'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800',
    ],
    description: 'ელეგანტური Audi A6 უახლესი თაობის ტექნოლოგიებით. Premium ხარისხი, კომფორტი და უსაფრთხოება.',
    features: ['GPS ნავიგაცია', 'Bluetooth', 'ნაჰის სავარძლები', 'Matrix LED', 'Virtual Cockpit', 'Bang & Olufsen Audio'],
    transmission: 'ავტომატიკა',
    fuelType: 'ბენზინი',
    seats: 5,
    location: 'ბათუმი',
    address: 'რუსთაველის ქუჩა 45',
    phone: '+995 557 123 456',
    email: 'batumi@carrental.ge',
    available: true,
    rating: 4.9,
    reviews: 67,
    totalBookings: 31,
    deposit: 200,
    minRentalDays: 2,
    maxRentalDays: 30,
    extras: {
      childSeat: 15,
      additionalDriver: 20,
      navigation: 0,
      insurance: 30,
    },
    isActive: true,
    views: 293,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

async function seedRentalCars() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🗑️ Clearing existing rental cars...');
    await CarRental.deleteMany({});
    console.log('✅ Cleared existing data');

    console.log('🚗 Adding rental cars...');
    const result = await CarRental.insertMany(rentalCars);
    console.log(`✅ Successfully added ${result.length} rental cars!`);

    console.log('\n📊 Summary:');
    rentalCars.forEach((car, index) => {
      console.log(`${index + 1}. ${car.brand} ${car.model} (${car.year}) - ${car.pricePerDay}₾/დღე - ${car.category}`);
    });

    console.log('\n🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the seeding function
seedRentalCars();

