import express from 'express';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPaymentDetails,
  initiateRefund,
} from '../controllers/payment.razorpay.controller.js';
import { protect, admin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/create-order', createRazorpayOrder);
router.post('/verify-payment', verifyRazorpayPayment);

// Protected routes (Admin only)
router.get('/payment/:paymentId', protect, admin, getPaymentDetails);
router.post('/refund', protect, admin, initiateRefund);

export default router;
