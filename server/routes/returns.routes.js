import express from 'express';
import {
  createReturnRequest,
  getAllReturns,
  getMyReturns,
  getReturnById,
  updateReturnStatus,
  processRefund,
  processReturnRefund,
  processExchange,
  restockReturnedItems,
  cancelReturnRequest,
  getReturnsStatistics,
} from '../controllers/returns.controller.js';
import { protect, admin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public/User routes
router.post('/', createReturnRequest); // Allow guest returns with order ID
router.get('/my-returns', protect, getMyReturns);
router.put('/:id/cancel', protect, cancelReturnRequest);

// Admin routes
router.get('/', protect, admin, getAllReturns);
router.get('/stats', protect, admin, getReturnsStatistics); // Must be before /:id
router.get('/:id', protect, getReturnById); // Generic param route last
router.put('/:id/status', protect, admin, updateReturnStatus);
router.post('/:id/refund', protect, admin, processRefund);
router.post('/:returnId/process-refund', protect, admin, processReturnRefund);
router.put('/:returnId/process-refund', protect, admin, processReturnRefund);
router.post('/:id/exchange', protect, admin, processExchange);
router.post('/:id/restock', protect, admin, restockReturnedItems);

export default router;
