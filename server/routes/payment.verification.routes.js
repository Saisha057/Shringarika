// ============================================================================
// Payment Verification Routes
// ============================================================================
// Purpose: API routes for UPI and Bank verification
// ============================================================================

import { Router } from 'express';
import {
  verifyUpi,
  verifyBank,
  savePaymentMethod,
  getPaymentMethods,
  updatePaymentMethod,
  deletePaymentMethod,
} from '../controllers/payment.verification.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

// ============================================================================
// VERIFICATION ROUTES (Protected)
// ============================================================================

/**
 * POST /api/verify-upi
 * Verify UPI ID and return registered name
 * Body: { upi_id: string }
 */
router.post('/verify-upi', protect, verifyUpi);

/**
 * POST /api/verify-bank
 * Verify bank account using Penny Drop
 * Body: { account_number: string, ifsc: string }
 */
router.post('/verify-bank', protect, verifyBank);

// ============================================================================
// PAYMENT METHOD CRUD ROUTES (Protected)
// ============================================================================

/**
 * GET /api/payment-methods
 * Get all payment methods for logged-in user
 */
router.get('/payment-methods', protect, getPaymentMethods);

/**
 * POST /api/payment-methods
 * Save a verified payment method
 * Body: { type, identifier, ifsc?, account_holder_name, is_default }
 */
router.post('/payment-methods', protect, savePaymentMethod);

/**
 * PATCH /api/payment-methods/:id
 * Update payment method (set default, deactivate)
 * Body: { is_default?, is_active? }
 */
router.patch('/payment-methods/:id', protect, updatePaymentMethod);

/**
 * DELETE /api/payment-methods/:id
 * Soft delete payment method
 */
router.delete('/payment-methods/:id', protect, deletePaymentMethod);

// ============================================================================
// EXPORT
// ============================================================================

export default router;
