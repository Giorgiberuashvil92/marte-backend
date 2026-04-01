const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection string - იგივე რაც backend-ში
const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://gberuashvili123:vhOQ0UhtFUM8S8eg@carappx.lh8hx2q.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=CarappX';

async function viewPayments() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('carapp-v2');
    const paymentsCollection = db.collection('payments');
    const subscriptionsCollection = db.collection('subscriptions');
    
    // ყველა payment-ის მიღება (მათ შორის recurring payment-ებიც)
    const payments = await paymentsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 PAYMENTS (სულ: ${payments.length})`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (payments.length === 0) {
      console.log('⚠️ Payment-ები არ მოიძებნა');
    } else {
      payments.forEach((payment, index) => {
        console.log(`\n${index + 1}. Payment ID: ${payment._id}`);
        console.log(`   • User ID: ${payment.userId}`);
        console.log(`   • Order ID: ${payment.orderId}`);
        console.log(`   • Amount: ${payment.amount} ${payment.currency}`);
        console.log(`   • Status: ${payment.status}`);
        console.log(`   • Payment Method: ${payment.paymentMethod}`);
        console.log(`   • Context: ${payment.context} ${payment.isRecurring ? '🔄 (Recurring)' : ''}`);
        console.log(`   • Description: ${payment.description}`);
        console.log(`   • Payment Token: ${payment.paymentToken || 'N/A'}`);
        if (payment.isRecurring) {
          console.log(`   • Recurring Payment ID: ${payment.recurringPaymentId || 'N/A'}`);
          console.log(`   • Is Recurring: ✅ YES`);
        }
        console.log(`   • Payment Date: ${payment.paymentDate || 'N/A'}`);
        console.log(`   • Metadata: ${JSON.stringify(payment.metadata || {}, null, 2)}`);
        console.log(`   • Created: ${payment.createdAt}`);
        console.log(`   • Updated: ${payment.updatedAt}`);
        
        // რეალური payment-ის შემოწმება
        const isRealPayment = payment.orderId && 
                             payment.orderId.length > 20 && 
                             payment.status === 'completed' &&
                             payment.paymentMethod === 'BOG';
        console.log(`   • 🔍 Real Payment: ${isRealPayment ? '✅ YES' : '❌ NO'}`);
        console.log('   ───────────────────────────────────────────────');
      });
    }
    
    // Subscriptions
    const subscriptions = await subscriptionsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log(`📋 SUBSCRIPTIONS (სულ: ${subscriptions.length})`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (subscriptions.length === 0) {
      console.log('⚠️ Subscription-ები არ მოიძებნა');
    } else {
      subscriptions.forEach((sub, index) => {
        console.log(`\n${index + 1}. Subscription ID: ${sub._id}`);
        console.log(`   • User ID: ${sub.userId}`);
        console.log(`   • Plan: ${sub.planName}`);
        console.log(`   • Price: ${sub.planPrice} ${sub.currency}`);
        console.log(`   • Period: ${sub.period}`);
        console.log(`   • Status: ${sub.status}`);
        console.log(`   • BOG Token: ${sub.bogCardToken || 'N/A'}`);
        console.log(`   • Next Billing: ${sub.nextBillingDate ? new Date(sub.nextBillingDate).toISOString() : 'N/A'}`);
        console.log(`   • Billing Cycles: ${sub.billingCycles}`);
        console.log(`   • Total Paid: ${sub.totalPaid} ${sub.currency}`);
        console.log(`   • Created: ${sub.createdAt}`);
        console.log('   ───────────────────────────────────────────────');
      });
    }
    
    // Statistics
    const totalPayments = await paymentsCollection.countDocuments({});
    const completedPayments = await paymentsCollection.countDocuments({ status: 'completed' });
    const totalAmount = await paymentsCollection.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('📈 STATISTICS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   • Total Payments: ${totalPayments}`);
    console.log(`   • Completed Payments: ${completedPayments}`);
    console.log(`   • Total Revenue: ${totalAmount[0]?.total || 0} GEL`);
    console.log(`   • Active Subscriptions: ${subscriptions.filter(s => s.status === 'active').length}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('✅ MongoDB connection closed');
  }
}

viewPayments();

