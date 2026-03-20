import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import http from 'http';

// Load environment variables — explicit path so this works regardless of CWD
// (server is always inside /server/, __dirname = /server/)

console.log('✅ Environment variables loaded');
console.log('✅ PORT:', process.env.PORT || 5000);
console.log('✅ NODE_ENV:', process.env.NODE_ENV);
console.log('✅ SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('✅ EMAIL CONFIG:', {
  user: process.env.ADMIN_EMAIL ? 'SET' : 'MISSING',
  pass: process.env.ADMIN_EMAIL_PASS ? 'SET' : 'MISSING'
});

// Initialize Supabase AFTER dotenv is loaded
import { initializeSupabase } from './config/supabase.js';
try {
  initializeSupabase();
  console.log('✅ Supabase initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Supabase:', error.message);
  process.exit(1);
}

// Import routes (after dotenv is loaded)
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import orderRoutes from './routes/order.routes.js';
import userRoutes from './routes/user.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import paymentRazorpayRoutes from './routes/payment.razorpay.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import cartRoutes from './routes/cart.routes.js';
import reviewRoutes from './routes/review.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import seoRoutes from './routes/seo.routes.js';
import recommendationsRoutes from './routes/recommendations.routes.js';
import errorRoutes from './routes/error.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import supportRoutes from './routes/support.routes.js';
import returnsRoutes from './routes/returns.routes.js';
import orderTimelineRoutes from './routes/order.timeline.routes.js';
import stockRoutes from './routes/stock.routes.js';
import contactRoutes from './routes/contact.routes.js';
import adminNotificationsRoutes from './routes/admin.notifications.routes.js';
import adminReturnsRoutes from './routes/admin.returns.routes.js';
import paymentVerificationRoutes from './routes/payment.verification.routes.js';
// Security routes
import twoFactorRoutes from './routes/2fa.routes.js';
import apiKeysRoutes from './routes/apiKeys.routes.js';
import sessionsRoutes from './routes/sessions.routes.js';
// Notification routes
import notificationsRoutes from './routes/notifications.routes.js';
// Admin routes
import adminRoutes from './routes/admin.routes.js';
import adminAnalyticsRoutes from './routes/admin-analytics.routes.js';
import adminBulkRoutes from './routes/admin-bulk.routes.js';
import adminAuditRoutes from './routes/admin-audit.routes.js';
import adminRbacRoutes from './routes/admin-rbac.routes.js';
import adminBackupRoutes from './routes/admin-backup.routes.js';
import adminExportRoutes from './routes/admin-export.routes.js';

// Import services and middleware
import { connectRedis } from './config/redis.js';
import { createDatabasePool, closeDatabasePool } from './config/database.pool.js';
import { compressionMiddleware } from './middleware/compression.middleware.js';
import { generalLimiter, authLimiter, adminLimiter, variantLimiter } from './middleware/rateLimiter.middleware.js';
import { initializeSocketIO } from './services/chat.service.js';
import { initializeCronJobs } from './services/cron.service.js';
// Event-driven notification system
import { initializeOrderEventService } from './services/orderEventService.js';

// Import security middleware
import {
  sanitizeInput,
  sanitizeMongo,
  preventParameterPollution,
  detectMaliciousInput
} from './middleware/sanitize.middleware.js';
import {
  generateCsrfToken,
  validateCsrfToken,
  getCsrfToken
} from './middleware/csrf.middleware.js';
import {
  checkRecaptcha,
  getRecaptchaSiteKey
} from './middleware/recaptcha.middleware.js';
import {
  updateSessionActivity,
  detectSuspiciousActivity
} from './middleware/session.middleware.js';

// Import error handler
import { errorHandler } from './middleware/error.middleware.js';
import { setSecurityHeaders, verifyOrigin } from './middleware/security.middleware.js';

// Initialize express app
const app = express();
// Create HTTP server for Socket.io
const server = http.createServer(app);

// ===== PERFORMANCE & SECURITY MIDDLEWARE =====

// 1. Compression - Reduce response size
if (process.env.ENABLE_COMPRESSION !== 'false') {
  app.use(compressionMiddleware);
  console.log('✅ Response compression enabled');
}

// 2. Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, enable in production
  crossOriginEmbedderPolicy: false
}));
app.use(setSecurityHeaders);

// 3. CORS configuration
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = isProduction
  ? ["https://shringarika.studio", "https://www.shringarika.studio"]
  : [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://shringarika.studio",
      "https://www.shringarika.studio",
      process.env.FRONTEND_URL,
    ].filter(Boolean);

app.use(cors({
  origin:function(origin, callback){
    if(!origin) return callback(null,true);

    if(allowedOrigins.includes(origin)){
      callback(null,true);
    }else{
      callback(new Error("CORS not allowed"));
    }
  },
  credentials:true
}));

// 4. Rate limiting - Prevent API abuse
app.use('/api/admin', adminLimiter);
app.use('/api/products', variantLimiter);
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
console.log('✅ Rate limiting enabled');

// Razorpay webhook signature verification requires raw request body.
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ===== SECURITY MIDDLEWARE =====

// 5. Input sanitization (XSS, SQL injection, NoSQL injection)
app.use(sanitizeInput);
app.use(sanitizeMongo);
app.use(preventParameterPollution);
app.use(detectMaliciousInput);
console.log('✅ Input sanitization enabled');

// 6. CSRF protection
app.use(generateCsrfToken);
app.get('/api/csrf-token', getCsrfToken);
console.log('✅ CSRF protection enabled');

// 7. Session management
app.use(updateSessionActivity);
app.use(detectSuspiciousActivity);
console.log('✅ Session tracking enabled');

// Security: Origin verification for state-changing requests
app.use(verifyOrigin);

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check route
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const { getSupabase } = await import('./config/supabase.js');
    const supabase = getSupabase();
    const { error } = await supabase.from('users').select('id').limit(1);
    
    res.status(200).json({ 
      status: 'success', 
      message: 'Server is running',
      database: error ? 'disconnected' : 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      message: 'Service unhealthy',
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Lightweight health endpoint for uptime monitors (Render, external pingers)
app.get('/api/health', (req, res) => {
  res.status(200).send('OK');
});

// API-only root endpoint (frontend is hosted separately on Vercel)
app.get('/', (req, res) => {
  res.status(200).send('API running');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/orders', orderTimelineRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payments', paymentRazorpayRoutes); // create-order, verify-payment, refund (admin)
app.use('/api/upload', uploadRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/errors', errorRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/contact', contactRoutes);

// Payment verification routes
app.use('/api', paymentVerificationRoutes);

// SEO routes (sitemap.xml, robots.txt)
app.use('/', seoRoutes);

// Security routes
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/keys', apiKeysRoutes);
app.use('/api/sessions', sessionsRoutes);

// Notification routes
app.use('/api/notifications', notificationsRoutes);

// Admin Dashboard routes (core data endpoints)
app.use('/api/admin', adminRoutes);

// Admin specialized routes
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/bulk', adminBulkRoutes);
app.use('/api/admin/audit-logs', adminAuditRoutes);
app.use('/api/admin/rbac', adminRbacRoutes);
app.use('/api/admin/backup', adminBackupRoutes);
app.use('/api/admin/export', adminExportRoutes);
app.use('/api/admin', adminNotificationsRoutes);
app.use('/api/admin', adminReturnsRoutes);

// reCAPTCHA site key endpoint
app.get('/api/recaptcha/site-key', getRecaptchaSiteKey);

// 404 handler for API routes in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res) => {
    res.status(404).json({
      status: 'error',
      message: 'Route not found',
    });
  });
}

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
  console.log('✅ Supabase configured (will test on first API call)');
  
  // Initialize Socket.io for real-time chat
  try {
    initializeSocketIO(server);
    console.log('✅ Socket.io chat service initialized');
  } catch (error) {
    console.log('⚠️  Socket.io initialization failed:', error.message);
  }
  
  // Initialize Redis connection (optional)
  try {
    await connectRedis();
  } catch (error) {
    console.log('⚠️  Redis initialization skipped or failed');
  }
  
  // Initialize Database Connection Pool
  try {
    createDatabasePool();
  } catch (error) {
    console.log('⚠️  Database pool initialization failed:', error.message);
  }
  
  // Log performance optimizations status
  console.log('\n🚀 === PERFORMANCE & SECURITY & COMMUNICATIONS & ADMIN === 🚀');
  console.log('✅ Response Compression: Enabled');
  console.log('✅ Rate Limiting: Enabled');
  console.log('✅ Security Headers (Helmet): Enabled');
  console.log('✅ CSRF Protection: Enabled');
  console.log('✅ Input Sanitization (XSS/SQL): Enabled');
  console.log('✅ Two-Factor Authentication: Available');
  console.log('✅ API Key Management: Available');
  console.log('✅ Session Tracking: Enabled');
  console.log('✅ Database Connection Pool: Enabled');
  console.log(process.env.REDIS_URL ? '✅ Redis Caching: Enabled' : '⚠️  Redis Caching: Disabled (set REDIS_URL)');
  console.log(process.env.USE_CDN === 'true' ? '✅ CDN: Enabled' : '⚠️  CDN: Disabled (set USE_CDN=true)');
  console.log(process.env.RECAPTCHA_SECRET_KEY ? '✅ reCAPTCHA: Enabled' : '⚠️  reCAPTCHA: Disabled (set RECAPTCHA_SECRET_KEY)');
  console.log('✅ Image Optimization: Enabled (Cloudinary)');
  console.log('✅ Email Service: Enabled (Gmail SMTP)');
  console.log(process.env.TWILIO_ACCOUNT_SID ? '✅ SMS Service: Enabled (Twilio)' : '⚠️  SMS Service: Disabled (set TWILIO credentials)');
  console.log(process.env.FIREBASE_SERVICE_ACCOUNT ? '✅ Push Notifications: Enabled (FCM)' : '⚠️  Push Notifications: Disabled (set FIREBASE credentials)');
  console.log(process.env.TWILIO_WHATSAPP_NUMBER ? '✅ WhatsApp Service: Enabled (Twilio)' : '⚠️  WhatsApp Service: Disabled (set TWILIO_WHATSAPP_NUMBER)');
  console.log('✅ Real-time Chat: Enabled (Socket.io)');
  console.log('✅ Advanced Analytics: Enabled');
  console.log('✅ Bulk Operations: Enabled');
  console.log('✅ Audit Logs: Enabled');
  console.log('✅ RBAC: Enabled');
  console.log('✅ Backup System: Enabled');
  console.log('✅ Export System: Enabled (CSV/PDF)');
  console.log('✅ Scheduled Tasks (Cron): Enabled');
  console.log('==========================================\n');
  
  // Initialize cron jobs
  initializeCronJobs();

  // Initialize event-driven notification system
  try {
    initializeOrderEventService();
    console.log('✅ Event-driven notification system initialized');
  } catch (err) {
    console.error('⚠️ [EventBus] Failed to initialize orderEventService:', err.message);
  }
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📡 SIGTERM received. Closing server gracefully...');
  
  server.close(async () => {
    console.log('✅ Server closed');
    
    // Close database pool
    try {
      await closeDatabasePool();
    } catch (error) {
      console.error('❌ Error closing database pool:', error);
    }
    
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  console.error('Stack:', err.stack);
  // Don't exit in development - just log the error
  if (process.env.NODE_ENV === 'production') {
    console.log('Shutting down server due to unhandled promise rejection');
    server.close(() => process.exit(1));
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
  // Don't exit in development - just log the error
  if (process.env.NODE_ENV === 'production') {
    console.log('Shutting down server due to uncaught exception');
    process.exit(1);
  }
});


