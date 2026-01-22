import * as fs from 'fs';
import * as path from 'path';

// This script can be run manually to import car brands from carData.json
// Usage: ts-node scripts/import-car-brands.ts

const carDataPath = path.join(__dirname, '../../data/carData.json');

async function importCarBrands() {
  try {
    const carData = JSON.parse(fs.readFileSync(carDataPath, 'utf-8'));
    const brandsData = carData.brands;

    // Make HTTP request to import endpoint
    const API_URL = process.env.API_URL || 'http://localhost:3000';
    const response = await fetch(`${API_URL}/car-brands/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(brandsData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Import result:', result);
    console.log(`✅ Created: ${result.created}, Updated: ${result.updated}`);
    if (result.errors.length > 0) {
      console.log('⚠️ Errors:', result.errors);
    }
  } catch (error) {
    console.error('Error importing car brands:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  importCarBrands();
}

export { importCarBrands };
