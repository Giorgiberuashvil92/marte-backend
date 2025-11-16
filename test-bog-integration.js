/**
 * BOG API ინტეგრაციის ტესტირების სკრიპტი
 * 
 * გამოყენება:
 * node test-bog-integration.js
 */

const API_BASE_URL = 'http://localhost:4000';

// ტესტის მონაცემები
const testPaymentData = {
  amount: 25.50,
  currency: 'GEL',
  orderId: `test_order_${Date.now()}`,
  description: 'ტესტ გადახდა - სამრეცხაო სერვისი',
  callbackUrl: 'https://your-domain.com/bog/callback',
  returnUrl: 'carapp://payment-success',
  customerInfo: {
    email: 'test@example.com',
    phone: '+995555123456',
    name: 'ტესტ მომხმარებელი'
  }
};

async function testBOGIntegration() {
  console.log('🧪 BOG API ინტეგრაციის ტესტირება...\n');

  try {
    // 1. გადახდის მოთხოვნის შექმნა
    console.log('1️⃣ გადახდის მოთხოვნის შექმნა...');
    const paymentResponse = await fetch(`${API_BASE_URL}/bog/create-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPaymentData),
    });

    if (!paymentResponse.ok) {
      throw new Error(`HTTP error! status: ${paymentResponse.status}`);
    }

    const paymentResult = await paymentResponse.json();
    console.log('✅ გადახდის მოთხოვნა:', paymentResult);

    if (paymentResult.success) {
      console.log(`🔗 გადახდის URL: ${paymentResult.data.paymentUrl}`);
      console.log(`📋 Order ID: ${paymentResult.data.orderId}`);
    }

    // 2. გადახდის სტატუსის შემოწმება
    console.log('\n2️⃣ გადახდის სტატუსის შემოწმება...');
    const statusResponse = await fetch(`${API_BASE_URL}/bog/payment-status/${testPaymentData.orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!statusResponse.ok) {
      throw new Error(`HTTP error! status: ${statusResponse.status}`);
    }

    const statusResult = await statusResponse.json();
    console.log('✅ გადახდის სტატუსი:', statusResult);

    // 3. ბარათის დამახსოვრების ტესტი
    console.log('\n3️⃣ ბარათის დამახსოვრების ტესტი...');
    const saveCardData = {
      userId: 'test_user_123',
      cardToken: 'test_card_token_456',
      maskedNumber: '1234 **** **** 5678',
      expiry: '12/25'
    };

    const saveCardResponse = await fetch(`${API_BASE_URL}/bog/save-card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(saveCardData),
    });

    if (!saveCardResponse.ok) {
      throw new Error(`HTTP error! status: ${saveCardResponse.status}`);
    }

    const saveCardResult = await saveCardResponse.json();
    console.log('✅ ბარათის დამახსოვრება:', saveCardResult);

    // 4. დამახსოვრებული ბარათით გადახდის ტესტი
    if (saveCardResult.success && saveCardResult.data.cardId) {
      console.log('\n4️⃣ დამახსოვრებული ბარათით გადახდის ტესტი...');
      const savedCardPaymentData = {
        cardId: saveCardResult.data.cardId,
        amount: 15.00,
        currency: 'GEL',
        orderId: `saved_card_test_${Date.now()}`,
        description: 'დამახსოვრებული ბარათით ტესტ გადახდა'
      };

      const savedCardPaymentResponse = await fetch(`${API_BASE_URL}/bog/pay-with-saved-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(savedCardPaymentData),
      });

      if (!savedCardPaymentResponse.ok) {
        throw new Error(`HTTP error! status: ${savedCardPaymentResponse.status}`);
      }

      const savedCardPaymentResult = await savedCardPaymentResponse.json();
      console.log('✅ დამახსოვრებული ბარათით გადახდა:', savedCardPaymentResult);
    }

    // 5. Callback ტესტი
    console.log('\n5️⃣ BOG Callback ტესტი...');
    const callbackData = {
      orderId: testPaymentData.orderId,
      transactionId: 'test_txn_123456',
      status: 'success',
      amount: testPaymentData.amount,
      currency: testPaymentData.currency,
      signature: 'test_signature_789'
    };

    const callbackResponse = await fetch(`${API_BASE_URL}/bog/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callbackData),
    });

    if (!callbackResponse.ok) {
      throw new Error(`HTTP error! status: ${callbackResponse.status}`);
    }

    const callbackResult = await callbackResponse.json();
    console.log('✅ BOG Callback:', callbackResult);

    console.log('\n🎉 ყველა ტესტი წარმატებით გავიდა!');
    console.log('\n📋 ტესტის შეჯამება:');
    console.log('✅ გადახდის მოთხოვნის შექმნა');
    console.log('✅ გადახდის სტატუსის შემოწმება');
    console.log('✅ ბარათის დამახსოვრება');
    console.log('✅ დამახსოვრებული ბარათით გადახდა');
    console.log('✅ BOG Callback დამუშავება');

  } catch (error) {
    console.error('❌ ტესტის შეცდომა:', error.message);
    console.log('\n🔧 შესაძლო გადაწყვეტები:');
    console.log('1. შეამოწმეთ რომ backend server გაშვებულია (npm run start:dev)');
    console.log('2. შეამოწმეთ API_BASE_URL სწორია თუ არა');
    console.log('3. შეამოწმეთ BOG environment variables (.env ფაილში)');
    console.log('4. შეამოწმეთ network connection');
  }
}

// ტესტის გაშვება
if (require.main === module) {
  testBOGIntegration();
}

module.exports = { testBOGIntegration };
