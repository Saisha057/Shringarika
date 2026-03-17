import nodemailer from 'nodemailer';

export const sendEmail = async (options) => {
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // Define email options
  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  // Send email
  await transporter.sendMail(mailOptions);
};

export const getOrderEmailTemplate = (order) => {
  // Handle both old and new field names for compatibility
  const orderId = order.order_number || order.id || order._id;
  const orderDate = order.created_at || order.createdAt;
  const items = order.order_items || order.orderItems || [];
  const shippingAddr = order.shipping_address || order.shippingAddress || {};
  const paymentMethod = order.payment_method || order.paymentMethod || 'COD';
  const totalAmount = order.total_price || order.totalPrice || order.total_amount || 0;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .order-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .item { border-bottom: 1px solid #eee; padding: 10px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .total { font-size: 18px; font-weight: bold; color: #4F46E5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmation</h1>
        </div>
        <div class="content">
          <h2>Thank you for your order!</h2>
          <p>Order Number: <strong>#${orderId}</strong></p>
          <p>Order Date: ${new Date(orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          
          <div class="order-details">
            <h3>Order Items:</h3>
            ${items.map(item => `
              <div class="item">
                <p><strong>${item.productName || item.name}</strong></p>
                <p>Quantity: ${item.quantity} ${item.variant?.size || item.size ? `| Size: ${item.variant?.size || item.size}` : ''} ${item.variant?.color || item.color ? `| Color: ${item.variant?.color || item.color}` : ''}</p>
                <p>Price: ₹${item.pricePerItem || item.price} × ${item.quantity} = ₹${item.lineTotal || (item.pricePerItem || item.price) * item.quantity}</p>
              </div>
            `).join('')}
          </div>
          
          <div class="order-details">
            <h3>Shipping Address:</h3>
            <p><strong>${shippingAddr.fullName || shippingAddr.name || order.customer_name || 'Customer'}</strong></p>
            <p>${shippingAddr.address || shippingAddr.doorNo || ''} ${shippingAddr.street || ''}</p>
            <p>${shippingAddr.city || ''}, ${shippingAddr.state || ''} - ${shippingAddr.pincode || shippingAddr.pinCode || ''}</p>
            <p>Phone: ${shippingAddr.phone || order.customer_phone || ''}</p>
          </div>
          
          <div class="order-details">
            <h3>Payment Details:</h3>
            <p>Payment Method: <strong>${paymentMethod}</strong></p>
            <p>Subtotal: ₹${order.subtotal || order.items_price || 0}</p>
            ${order.tax || order.tax_price ? `<p>Tax (GST): ₹${order.tax || order.tax_price}</p>` : ''}
            ${order.delivery_charge || order.shipping_price ? `<p>Delivery: ₹${order.delivery_charge || order.shipping_price}</p>` : ''}
            ${order.discount ? `<p>Discount: -₹${order.discount}</p>` : ''}
            <p class="total">Total Amount: ₹${totalAmount}</p>
          </div>
          
          ${order.estimated_delivery_date ? `
          <div class="order-details">
            <h3>Estimated Delivery:</h3>
            <p>${new Date(order.estimated_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
          ` : ''}
        </div>
        <div class="footer">
          <p>If you have any questions, please contact us at shringarika11@gmail.com</p>
          <p>&copy; 2024 Shringarika. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getWelcomeEmailTemplate = (name) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .cta-button { display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Shringarika!</h1>
        </div>
        <div class="content">
          <h2>Hello ${name}!</h2>
          <p>Thank you for joining Shringarika. We're excited to have you on board!</p>
          <p>Explore our collection of beautiful sarees, kurtis, lehengas, and more.</p>
          <a href="${process.env.FRONTEND_URL}" class="cta-button">Start Shopping</a>
        </div>
        <div class="footer">
          <p>&copy; 2024 Shringarika. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getOrderStatusEmailTemplate = (order, status) => {
  const statusMessages = {
    processing: {
      title: 'Order is Being Processed',
      message: 'Your order is being prepared for shipment.',
    },
    shipped: {
      title: 'Order Shipped!',
      message: 'Your order has been shipped and is on its way to you.',
    },
    delivered: {
      title: 'Order Delivered',
      message: 'Your order has been successfully delivered.',
    },
  };

  const statusInfo = statusMessages[status] || { title: 'Order Update', message: 'Your order status has been updated.' };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .order-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .status-badge { display: inline-block; padding: 5px 15px; background-color: #10B981; color: white; border-radius: 20px; text-transform: uppercase; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${statusInfo.title}</h1>
        </div>
        <div class="content">
          <p>${statusInfo.message}</p>
          <div class="order-details">
            <p>Order ID: <strong>#${order._id}</strong></p>
            <p>Status: <span class="status-badge">${status}</span></p>
            ${order.trackingNumber ? `<p>Tracking Number: <strong>${order.trackingNumber}</strong></p>` : ''}
            <p>Total: <strong>₹${order.totalPrice}</strong></p>
          </div>
          <p>Track your order <a href="${process.env.FRONTEND_URL}/track-order">here</a></p>
        </div>
        <div class="footer">
          <p>Thank you for shopping with Shringarika!</p>
          <p>&copy; 2024 Shringarika. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getRestockNotificationTemplate = (productName, email) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .cta-button { display: inline-block; padding: 12px 30px; background-color: #F59E0B; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Good News! Product Back in Stock</h1>
        </div>
        <div class="content">
          <h2>${productName} is Now Available!</h2>
          <p>The product you were waiting for is back in stock. Hurry, grab it before it's gone again!</p>
          <a href="${process.env.FRONTEND_URL}/products" class="cta-button">Shop Now</a>
        </div>
        <div class="footer">
          <p>&copy; 2024 Shringarika. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getReturnEmailTemplate = ({ orderNumber, customerName, reasons, refundMethod }) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #DC2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Return Request Received</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          <p>We have received your return request for Order #${orderNumber}.</p>
          
          <div class="details">
            <h3>Return Details:</h3>
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Return Reasons:</strong></p>
            <ul>
              ${reasons.map(r => `<li>${r}</li>`).join('')}
            </ul>
            <p><strong>Refund Method:</strong> ${refundMethod}</p>
          </div>
          
          <p>Our team will review your request within 24-48 hours. You will receive an email once your return is approved.</p>
          <p>The refund will be processed within 5-7 business days after we receive the returned product.</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 Shringarika. All rights reserved.</p>
          <p>Need help? Contact us at shringarika11@gmail.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getExchangeEmailTemplate = ({ orderNumber, customerName, itemName, originalSize, originalColor, newSize, newColor }) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563EB; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Exchange Request Received</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          <p>We have received your exchange request for Order #${orderNumber}.</p>
          
          <div class="details">
            <h3>Exchange Details:</h3>
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Item:</strong> ${itemName}</p>
            <p><strong>Original:</strong> Size ${originalSize}, Color ${originalColor}</p>
            <p><strong>Exchange To:</strong> Size ${newSize}, Color ${newColor}</p>
          </div>
          
          <p>Our team will verify stock availability and process your exchange request within 24-48 hours.</p>
          <p>You will receive a confirmation email once your exchange is approved and shipped.</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 Shringarika. All rights reserved.</p>
          <p>Need help? Contact us at shringarika11@gmail.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getRefundEmailTemplate = ({ orderNumber, customerName, refundAmount, refundMethod }) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #059669; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .amount { font-size: 24px; color: #059669; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Refund Initiated</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          <p>Good news! Your refund has been initiated for Order #${orderNumber}.</p>
          
          <div class="details">
            <h3>Refund Details:</h3>
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Refund Amount:</strong> <span class="amount">₹${refundAmount}</span></p>
            <p><strong>Refund Method:</strong> ${refundMethod}</p>
            <p><strong>Processing Time:</strong> 5-7 business days</p>
          </div>
          
          <p>The refund will be credited to your selected payment method within 5-7 business days.</p>
          <p>You will receive a confirmation once the refund is completed.</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 Shringarika. All rights reserved.</p>
          <p>Need help? Contact us at shringarika11@gmail.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getDeliveryEmailTemplate = (order) => {
  const orderId = order.order_number || order.id || order._id;
  const items = order.order_items || order.orderItems || [];
  const shippingAddr = order.shipping_address || order.shippingAddress || {};
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Order Delivered!</h1>
        </div>
        <div class="content">
          <div class="success-icon">✅</div>
          <p>Great news! Your order has been successfully delivered.</p>
          <p>Order Number: <strong>#${orderId}</strong></p>
          
          <div class="details">
            <h3>Delivered Items:</h3>
            ${items.map(item => `
              <p>• ${item.productName || item.name} ${item.variant?.size || item.size ? `(Size: ${item.variant?.size || item.size})` : ''} × ${item.quantity}</p>
            `).join('')}
          </div>
          
          <div class="details">
            <h3>Delivery Address:</h3>
            <p><strong>${shippingAddr.fullName || shippingAddr.name || order.customer_name || 'Customer'}</strong></p>
            <p>${shippingAddr.address || shippingAddr.doorNo || ''} ${shippingAddr.street || ''}</p>
            <p>${shippingAddr.city || ''}, ${shippingAddr.state || ''} - ${shippingAddr.pincode || shippingAddr.pinCode || ''}</p>
          </div>
          
          <div class="details">
            <h3>Need to Return or Exchange?</h3>
            <p>If you're not satisfied with your order, you can return or exchange items within 7 days of delivery.</p>
            <p>Simply log in to your account and visit the "My Orders" section to initiate a return or exchange.</p>
          </div>
          
          <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders" class="button">View My Orders</a>
          </p>
          
          <p>Thank you for shopping with Shringarika! We hope you love your purchase. 💖</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 Shringarika. All rights reserved.</p>
          <p>Need help? Contact us at shringarika11@gmail.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Email template for order status updates
export const getOrderStatusUpdateEmailTemplate = (order, previousStatus, newStatus) => {
  const orderId = order.order_number || order.id || order._id;
  const customerName = order.customer_name || order.shipping_address?.fullName || order.shippingAddress?.name || 'Customer';
  const items = order.order_items || order.orderItems || [];
  
  // Define status colors and messages
  const statusConfig = {
    'Pending': { color: '#F59E0B', icon: '⏳', message: 'Your order has been received and is awaiting confirmation.' },
    'Confirmed': { color: '#3B82F6', icon: '✓', message: 'Your order has been confirmed and will be processed soon.' },
    'Processing': { color: '#8B5CF6', icon: '📦', message: 'Your order is being prepared for shipment.' },
    'Packed': { color: '#A855F7', icon: '📦', message: 'Your order has been packed and is ready for pickup.' },
    'Shipped': { color: '#06B6D4', icon: '🚚', message: 'Your order has been shipped and is on its way to you!' },
    'Out for Delivery': { color: '#0EA5E9', icon: '🚚', message: 'Your order is out for delivery and will arrive today!' },
    'Delivered': { color: '#10B981', icon: '✅', message: 'Your order has been successfully delivered!' },
    'Cancelled': { color: '#EF4444', icon: '❌', message: 'Your order has been cancelled.' },
    'Returned': { color: '#F97316', icon: '↩️', message: 'Your order has been returned.' },
    'Refunded': { color: '#14B8A6', icon: '💰', message: 'Your refund has been initiated and will be processed within 5-7 business days.' }
  };
  
  const config = statusConfig[newStatus] || statusConfig['Pending'];
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${config.color}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .status-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .status-badge { display: inline-block; padding: 8px 20px; background-color: ${config.color}; color: white; border-radius: 20px; font-weight: bold; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .timeline { padding: 10px 0; }
        .timeline-item { padding: 5px 0; color: #666; }
        .timeline-item.active { color: ${config.color}; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background-color: ${config.color}; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Status Update</h1>
        </div>
        <div class="content">
          <div class="status-icon">${config.icon}</div>
          <p>Dear ${customerName},</p>
          <p>Your order status has been updated:</p>
          
          <div class="details">
            <p><strong>Order Number:</strong> #${orderId}</p>
            <p><strong>Previous Status:</strong> ${previousStatus}</p>
            <p><strong>Current Status:</strong> <span class="status-badge">${newStatus}</span></p>
            <p><strong>Updated At:</strong> ${new Date().toLocaleString('en-IN', { 
              day: '2-digit', 
              month: 'long', 
              year: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}</p>
          </div>
          
          <div class="details">
            <p style="font-size: 16px; color: ${config.color}; font-weight: bold;">${config.message}</p>
          </div>
          
          ${order.tracking_number ? `
          <div class="details">
            <p><strong>Tracking Number:</strong> ${order.tracking_number}</p>
          </div>
          ` : ''}
          
          ${order.estimated_delivery_date ? `
          <div class="details">
            <p><strong>Estimated Delivery:</strong> ${new Date(order.estimated_delivery_date).toLocaleDateString('en-IN', { 
              day: '2-digit', 
              month: 'long', 
              year: 'numeric' 
            })}</p>
          </div>
          ` : ''}
          
          <div class="details">
            <h3>Order Items:</h3>
            ${items.map(item => `
              <p>• ${item.productName || item.name} ${item.variant?.size || item.size ? `(Size: ${item.variant?.size || item.size})` : ''} × ${item.quantity}</p>
            `).join('')}
          </div>
          
          <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders" class="button">View Order Details</a>
          </p>
          
          ${newStatus === 'Delivered' ? `
          <div class="details" style="background-color: #FEF3C7; border-left: 4px solid #F59E0B;">
            <h4 style="margin-top: 0; color: #92400E;">📋 Return or Exchange</h4>
            <p>Not satisfied with your order? You can return or exchange items within 7 days of delivery.</p>
            <p>Visit your orders page to initiate a return or exchange.</p>
          </div>
          ` : ''}
        </div>
        <div class="footer">
          <p>If you have any questions, feel free to contact us.</p>
          <p>&copy; 2024 Shringarika. All rights reserved.</p>
          <p>Email: shringarika11@gmail.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

