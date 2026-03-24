// Create test orders through backend API (respects RLS policies)
async function createTestOrders() {
  console.log('\n🛒 Creating test orders through checkout API...\n');

  try {
    // First, get available products
    const productsResponse = await fetch('http://localhost:5000/api/products');
    const productsData = await productsResponse.json();
    const products = productsData.data || productsData;

    if (!products || products.length === 0) {
      console.error('❌ No products found!');
      return;
    }

    console.log(`✅ Found ${products.length} products\n`);

    // Create 5 test orders
    const orderPromises = [];
    
    for (let i = 0; i < 5; i++) {
      const product = products[i % products.length];
      const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 items
      
      const orderData = {
        contactDetails: {
          name: `TestCustomer${i + 1}`,
          email: `test${i + 1}@example.com`,
          phone: `98765432${10 + i}`,
        },
        shippingAddress: {
          fullName: `TestCustomer${i + 1}`,
          doorNo: `${100 + i}`,
          street: `Test Street`,
          city: 'TestCity',
          state: 'TestState',
          pinCode: '123456',
          email: `test${i + 1}@example.com`,
          phone: `98765432${10 + i}`,
        },
        orderItems: [
          {
            product: product.id,
            name: product.name,
            quantity: quantity,
            price: parseFloat(product.price),
            variant: {
              size: Array.isArray(product.sizes) && product.sizes.length ? product.sizes[0] : 'M',
              color: Array.isArray(product.colors) && product.colors.length ? product.colors[0] : '',
            },
          },
        ],
        itemsPrice: quantity * parseFloat(product.price),
        taxPrice: 0,
        shippingPrice: 0,
        discount: 0,
        totalPrice: quantity * parseFloat(product.price),
        paymentMethod: 'COD',
      };

      // Send order creation request
      const promise = fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            const orderId = data?.data?.orderId;
            const orderNumber = data?.data?.orderNumber;
            console.log(`✅ Order ${i + 1}: ${orderNumber || orderId}`);
            console.log(`   Product: ${product.name}`);
            console.log(`   Quantity: ${quantity} units`);
            console.log(`   Total: ₹${orderData.totalPrice}`);
            console.log(`   Payment: ${orderData.paymentMethod}\n`);
            return { orderId, orderNumber };
          } else {
            console.error(`❌ Order ${i + 1} failed:`, data.message);
            return null;
          }
        })
        .catch(err => {
          console.error(`❌ Order ${i + 1} error:`, err.message);
          return null;
        });

      orderPromises.push(promise);
      
      // Small delay between orders
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Wait for all orders
    const results = await Promise.all(orderPromises);
    const successful = results.filter(r => r !== null).length;

    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ ${successful}/5 orders created successfully`);
    console.log(`\n🎯 Now check analytics at: http://localhost:3000/admin`);
    console.log(`   Analytics should show ${successful} orders with items!\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n⚠️  Make sure backend is running on port 5000\n');
  }
}

createTestOrders();
