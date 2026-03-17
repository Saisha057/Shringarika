import express from 'express';
import { createOrder, verifyPayment, paymentWebhook, verifyUPI } from '../controllers/payment.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes — no auth required (guest checkout support + signature is cryptographic proof)
router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.post('/webhook', paymentWebhook);

// Protected routes
router.post('/verify-upi', protect, verifyUPI);

export default router;
