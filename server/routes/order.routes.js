import express from 'express';
import { body } from 'express-validator';
import {
  createOrder,
  getOrderById,
  updateOrderToPaid,
  updateOrderStatus,
  updateTracking,
  getMyOrders,
  getOrders,
  cancelOrder,
} from '../controllers/order.controller.js';
import { requestReturn, requestExchange, approveReturn, rejectReturn, approveExchange, rejectExchange } from '../controllers/return.controller.js';
import { protect, authorize, optionalProtect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = express.Router();

// Validation rules
const orderValidation = [
  body('orderItems').isArray({ min: 1 }).withMessage('Order items are required'),
  body('shippingAddress').notEmpty().withMessage('Shipping address is required'),
  body('paymentMethod').notEmpty().withMessage('Payment method is required'),
  body('totalPrice').isNumeric().withMessage('Total price must be a number'),
];

// Routes
router.post('/', optionalProtect, orderValidation, validate, createOrder); // Allow guest checkout
router.get('/', protect, authorize('admin'), getOrders);
router.get('/myorders', protect, getMyOrders);

// Return & Exchange routes
router.post('/:id/return', protect, requestReturn);
router.post('/:id/exchange', protect, requestExchange);
router.put('/:id/return/approve', protect, authorize('admin'), approveReturn);
router.put('/:id/return/reject', protect, authorize('admin'), rejectReturn);
router.put('/:id/exchange/approve', protect, authorize('admin'), approveExchange);
router.put('/:id/exchange/reject', protect, authorize('admin'), rejectExchange);
router.put('/:orderId/return/approve', protect, authorize('admin'), approveReturn);
router.put('/:orderId/return/reject', protect, authorize('admin'), rejectReturn);
router.put('/:orderId/exchange/approve', protect, authorize('admin'), approveExchange);
router.put('/:orderId/exchange/reject', protect, authorize('admin'), rejectExchange);

// Generic order routes (keep after specific action routes)
router.get('/:id', protect, getOrderById);
router.put('/:id/pay', protect, updateOrderToPaid);
router.put('/:id/status', protect, authorize('admin'), updateOrderStatus);
router.put('/:id/cancel', protect, cancelOrder);
router.patch('/:id/tracking', protect, authorize('admin'), updateTracking);

export default router;
