/**
 * Script რომელიც მიიღებს CarFAX რეპორტს VIN კოდისთვის და შეინახავს ფაილად
 * 
 * Usage: node scripts/get-carfax-report.js <VIN>
 * Example: node scripts/get-carfax-report.js wbxht3c36h5f80778
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const VIN = process.argv[2];

if (!VIN) {
  console.error('❌ გთხოვთ მიუთითოთ VIN კოდი');
  console.log('Usage: node scripts/get-carfax-report.js <VIN>');
  console.log('Example: node scripts/get-carfax-report.js wbxht3c36h5f80778');
  process.exit(1);
}

async function getCarFAXReport() {
  try {
    console.log(`🔍 CarFAX რეპორტის მოთხოვნა VIN: ${VIN}...`);

    // მივიღოთ რეპორტი PDF ფორმატში
    const response = await axios.post(
      `${API_BASE_URL}/carfax/report-file`,
      {
        vin: VIN,
        format: 'pdf',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'admin-script',
        },
        responseType: 'arraybuffer', // PDF-ისთვის
      }
    );

    // შევინახოთ PDF ფაილი
    const fileName = `CarFAX_Report_${VIN}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '..', 'reports', fileName);

    // შევქმნათ reports დირექტორია თუ არ არსებობს
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(filePath, response.data);

    console.log(`✅ CarFAX რეპორტი წარმატებით შეინახა:`);
    console.log(`   📄 ფაილი: ${filePath}`);
    console.log(`   📊 ზომა: ${(response.data.length / 1024).toFixed(2)} KB`);

    // ასევე შევინახოთ HTML ვერსიაც
    try {
      const htmlResponse = await axios.post(
        `${API_BASE_URL}/carfax/report-file`,
        {
          vin: VIN,
          format: 'html',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'admin-script',
          },
          responseType: 'text',
        }
      );

      const htmlFileName = `CarFAX_Report_${VIN}_${Date.now()}.html`;
      const htmlFilePath = path.join(reportsDir, htmlFileName);
      fs.writeFileSync(htmlFilePath, htmlResponse.data, 'utf-8');

      console.log(`✅ HTML რეპორტი წარმატებით შეინახა:`);
      console.log(`   📄 ფაილი: ${htmlFilePath}`);
    } catch (htmlError) {
      console.warn(`⚠️ HTML რეპორტის შენახვა ვერ მოხერხდა: ${htmlError.message}`);
    }
  } catch (error) {
    if (error.response) {
      console.error(`❌ API შეცდომა (${error.response.status}):`);
      try {
        const errorData = JSON.parse(Buffer.from(error.response.data).toString());
        console.error(`   ${errorData.message || errorData.error || 'უცნობი შეცდომა'}`);
      } catch {
        console.error(`   ${error.response.statusText}`);
      }
    } else if (error.request) {
      console.error('❌ სერვერთან დაკავშირება ვერ მოხერხდა');
      console.error(`   URL: ${API_BASE_URL}/carfax/report-file`);
      console.error('   შეამოწმეთ რომ backend სერვერი მუშაობს');
    } else {
      console.error(`❌ შეცდომა: ${error.message}`);
    }
    process.exit(1);
  }
}

getCarFAXReport();
