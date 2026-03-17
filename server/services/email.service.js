/**
 * Email Service - Professional HTML Email Templates
 * 
 * Features:
 * 1. Responsive HTML email templates
 * 2. Order confirmations
 * 3. Shipping updates
 * 4. Password reset
 * 5. Welcome emails
 * 6. Promotional emails
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Base email template wrapper
 */
const getBaseTemplate = (content) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shringarika</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 5px;
    }
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 30px 20px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white !important;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e9ecef;
    }
    .order-details {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .order-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .social-links {
      margin: 15px 0;
    }
    .social-links a {
      display: inline-block;
      margin: 0 10px;
      color: #667eea;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .email-container { margin: 0; border-radius: 0; }
      .content { padding: 20px 15px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>✨ Shringarika</h1>
      <p>Your Beauty, Our Passion</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <div class="social-links">
        <a href="https://facebook.com/shringarika">Facebook</a>
        <a href="https://instagram.com/shringarika">Instagram</a>
        <a href="https://twitter.com/shringarika">Twitter</a>
      </div>
      <p>© ${new Date().getFullYear()} Shringarika. All rights reserved.</p>
      <p>123 Beauty Street, Fashion District, Mumbai 400001</p>
      <p>
        <a href="${process.env.FRONTEND_URL}/unsubscribe" style="color: #667eea;">Unsubscribe</a> | 
        <a href="${process.env.FRONTEND_URL}/contact" style="color: #667eea;">Contact Us</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Welcome Email Template
 */
export const sendWelcomeEmail = async (user) => {
  try {
    const content = `
      <h2>Welcome to Shringarika! 🎉</h2>
      <p>Hi ${user.name},</p>
      <p>Thank you for joining Shringarika! We're thrilled to have you as part of our beauty community.</p>
      <p>Here's what you can do now:</p>
      <ul>
        <li>Browse our exclusive collection of beauty products</li>
        <li>Get personalized product recommendations</li>
        <li>Enjoy exclusive member-only discounts</li>
        <li>Track your orders in real-time</li>
      </ul>
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL}/products" class="button">Start Shopping</a>
      </div>
      <p>Need help? Our customer support team is always here for you.</p>
      <p>Best regards,<br>The Shringarika Team</p>
    `;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Shringarika" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Welcome to Shringarika! ✨',
      html: getBaseTemplate(content),
    });

    console.log(`Welcome email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Order Confirmation Email Template
 */
export const sendOrderConfirmationEmail = async (order, user) => {
  try {
    const itemsHTML = order.items.map(item => `
      <div class="order-item">
        <div>
          <strong>${item.product_name}</strong><br>
          <small>Quantity: ${item.quantity}</small>
        </div>
        <div>₹${(item.price * item.quantity).toFixed(2)}</div>
      </div>
    `).join('');

    const content = `
      <h2>Order Confirmed! 🎊</h2>
      <p>Hi ${user.name},</p>
      <p>Thank you for your order! We've received your order and will process it soon.</p>
      
      <div class="order-details">
        <h3>Order Details</h3>
        <p><strong>Order ID:</strong> #${order.order_id}</p>
        <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
        <p><strong>Payment Method:</strong> ${order.payment_method}</p>
        
        <h4 style="margin-top: 20px;">Items:</h4>
        ${itemsHTML}
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #667eea;">
          <div style="display: flex; justify-content: space-between; font-size: 16px;">
            <strong>Total Amount:</strong>
            <strong>₹${order.total_amount.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <h3>Shipping Address</h3>
      <div class="order-details">
        <p>${order.shipping_address.name}</p>
        <p>${order.shipping_address.address}</p>
        <p>${order.shipping_address.city}, ${order.shipping_address.state} ${order.shipping_address.pincode}</p>
        <p>Phone: ${order.shipping_address.phone}</p>
      </div>

      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL}/orders/${order.id}" class="button">Track Your Order</a>
      </div>

      <p>You'll receive another email when your order ships.</p>
      <p>Best regards,<br>The Shringarika Team</p>
    `;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Shringarika" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `Order Confirmation - #${order.order_id}`,
      html: getBaseTemplate(content),
    });

    console.log(`Order confirmation email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Order Shipped Email Template
 */
export const sendOrderShippedEmail = async (order, user, trackingInfo) => {
  try {
    const content = `
      <h2>Your Order Has Been Shipped! 📦</h2>
      <p>Hi ${user.name},</p>
      <p>Great news! Your order has been shipped and is on its way to you.</p>
      
      <div class="order-details">
        <h3>Shipping Details</h3>
        <p><strong>Order ID:</strong> #${order.order_id}</p>
        <p><strong>Tracking Number:</strong> ${trackingInfo.trackingNumber}</p>
        <p><strong>Carrier:</strong> ${trackingInfo.carrier}</p>
        <p><strong>Estimated Delivery:</strong> ${trackingInfo.estimatedDelivery}</p>
      </div>

      <div style="text-align: center;">
        <a href="${trackingInfo.trackingUrl}" class="button">Track Shipment</a>
      </div>

      <p>Please note: Delivery times are estimates and may vary.</p>
      <p>Best regards,<br>The Shringarika Team</p>
    `;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Shringarika" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `Your Order Has Been Shipped - #${order.order_id}`,
      html: getBaseTemplate(content),
    });

    console.log(`Shipping notification sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending shipping email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Order Delivered Email Template
 */
export const sendOrderDeliveredEmail = async (order, user) => {
  try {
    const content = `
      <h2>Your Order Has Been Delivered! 🎉</h2>
      <p>Hi ${user.name},</p>
      <p>Your order has been successfully delivered. We hope you love your new products!</p>
      
      <div class="order-details">
        <p><strong>Order ID:</strong> #${order.order_id}</p>
        <p><strong>Delivered On:</strong> ${new Date().toLocaleDateString()}</p>
      </div>

      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL}/orders/${order.id}/review" class="button">Write a Review</a>
      </div>

      <p>Have any issues with your order? Contact our support team within 7 days for returns or exchanges.</p>
      <p>Thank you for shopping with us!</p>
      <p>Best regards,<br>The Shringarika Team</p>
    `;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Shringarika" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `Order Delivered - #${order.order_id}`,
      html: getBaseTemplate(content),
    });

    console.log(`Delivery confirmation sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending delivery email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Password Reset Email Template
 */
export const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    const content = `
      <h2>Password Reset Request 🔒</h2>
      <p>Hi ${user.name},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </div>

      <p>This link will expire in 1 hour for security reasons.</p>
      <p><strong>Didn't request this?</strong> You can safely ignore this email.</p>
      
      <p style="margin-top: 20px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
        <strong>Security Tip:</strong> Never share your password with anyone. Shringarika will never ask for your password via email.
      </p>

      <p>Best regards,<br>The Shringarika Team</p>
    `;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Shringarika Security" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Reset Your Password - Shringarika',
      html: getBaseTemplate(content),
    });

    console.log(`Password reset email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Promotional Email Template
 */
export const sendPromotionalEmail = async (user, promotion) => {
  try {
    const content = `
      <h2>${promotion.title} 🎁</h2>
      <p>Hi ${user.name},</p>
      <p>${promotion.description}</p>
      
      ${promotion.imageUrl ? `
        <div style="text-align: center; margin: 20px 0;">
          <img src="${promotion.imageUrl}" alt="${promotion.title}" style="max-width: 100%; border-radius: 8px;">
        </div>
      ` : ''}

      <div class="order-details">
        <h3>Offer Details</h3>
        <p><strong>Discount:</strong> ${promotion.discount}% OFF</p>
        <p><strong>Code:</strong> <span style="font-size: 20px; color: #667eea; font-weight: bold;">${promotion.code}</span></p>
        <p><strong>Valid Until:</strong> ${new Date(promotion.expiresAt).toLocaleDateString()}</p>
      </div>

      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL}/products?promo=${promotion.code}" class="button">Shop Now</a>
      </div>

      <p>Don't miss out on this exclusive offer!</p>
      <p>Best regards,<br>The Shringarika Team</p>
    `;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Shringarika Offers" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: promotion.subject || promotion.title,
      html: getBaseTemplate(content),
    });

    console.log(`Promotional email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending promotional email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Low Stock Alert Email (Admin)
 */
export const sendLowStockAlert = async (product, adminEmail) => {
  try {
    const content = `
      <h2>Low Stock Alert ⚠️</h2>
      <p>The following product is running low on stock:</p>
      
      <div class="order-details">
        <p><strong>Product:</strong> ${product.name}</p>
        <p><strong>SKU:</strong> ${product.sku}</p>
        <p><strong>Current Stock:</strong> <span style="color: #dc3545; font-weight: bold;">${product.stock}</span></p>
        <p><strong>Alert Threshold:</strong> ${product.lowStockThreshold || 10}</p>
      </div>

      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL}/admin/products/${product.id}" class="button">Manage Stock</a>
      </div>

      <p>Please restock this product to avoid out-of-stock situations.</p>
    `;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Shringarika Inventory" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `Low Stock Alert - ${product.name}`,
      html: getBaseTemplate(content),
    });

    console.log(`Low stock alert sent for product: ${product.name}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending low stock alert:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Order Cancellation Email Template
 */
export const sendOrderCancellationEmail = async (order, user, reason) => {
  try {
    const content = `
      <h2>Order Cancelled</h2>
      <p>Hi ${user.name},</p>
      <p>Your order has been cancelled as requested.</p>
      
      <div class="order-details">
        <p><strong>Order ID:</strong> #${order.order_id}</p>
        <p><strong>Cancellation Reason:</strong> ${reason}</p>
        <p><strong>Refund Amount:</strong> ₹${order.total_amount.toFixed(2)}</p>
      </div>

      <p>Your refund will be processed within 5-7 business days to your original payment method.</p>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL}/products" class="button">Continue Shopping</a>
      </div>

      <p>If you have any questions, please contact our support team.</p>
      <p>Best regards,<br>The Shringarika Team</p>
    `;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Shringarika" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `Order Cancelled - #${order.order_id}`,
      html: getBaseTemplate(content),
    });

    console.log(`Cancellation email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending cancellation email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generic send email function
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: `"Shringarika" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: html || text,
      text: text || ''
    });

    console.log(`Email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

export default {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  sendPasswordResetEmail,
  sendPromotionalEmail,
  sendLowStockAlert,
  sendOrderCancellationEmail,
  sendEmail,
};
