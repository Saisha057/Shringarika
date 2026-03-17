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
} from '../controllers/payment.verification.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// ============================================================================
// VERIFICATION ROUTES (Protected)
// ============================================================================

/**
 * POST /api/verify-upi
 * Verify UPI ID and return registered name
 * Body: { upi_id: string }
 */
router.post('/verify-upi', authenticateToken, verifyUpi);

/**
 * POST /api/verify-bank
 * Verify bank account using Penny Drop
 * Body: { account_number: string, ifsc: string }
 */
router.post('/verify-bank', authenticateToken, verifyBank);

// ============================================================================
// PAYMENT METHOD CRUD ROUTES (Protected)
// ============================================================================

/**
 * GET /api/payment-methods
 * Get all payment methods for logged-in user
 */
router.get('/payment-methods', authenticateToken, getPaymentMethods);

/**
 * POST /api/payment-methods
 * Save a verified payment method
 * Body: { type, identifier, ifsc?, account_holder_name, is_default }
 */
router.post('/payment-methods', authenticateToken, savePaymentMethod);

/**
 * PATCH /api/payment-methods/:id
 * Update payment method (set default, deactivate)
 * Body: { is_default?, is_active? }
 */
router.patch('/payment-methods/:id', authenticateToken, updatePaymentMethod);

/**
 * DELETE /api/payment-methods/:id
 * Soft delete payment method
 */
router.delete('/payment-methods/:id', authenticateToken, deletePaymentMethod);

// ============================================================================
// EXPORT
// ============================================================================

export default router;
