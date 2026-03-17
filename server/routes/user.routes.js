import express from 'express';
import { body } from 'express-validator';
import {
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getSettings,
  updateSettings,
  changePassword,
  updatePrivacySettings,
  deleteAccount,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
} from '../controllers/user.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = express.Router();

// Validation rules
const profileValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('phone').optional().matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits'),
];

const addressValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits'),
  body('doorNo').trim().notEmpty().withMessage('Door number is required'),
  body('street').trim().notEmpty().withMessage('Street is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('pinCode').matches(/^[0-9]{6}$/).withMessage('Pin code must be 6 digits'),
];

// User profile routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, profileValidation, validate, updateProfile);

// Address routes
router.get('/addresses', protect, getAddresses);
router.post('/addresses', protect, addressValidation, validate, addAddress);
router.put('/addresses/:addressId', protect, updateAddress);
router.delete('/addresses/:addressId', protect, deleteAddress);

// Wishlist routes
router.get('/wishlist', protect, getWishlist);
router.post('/wishlist/:productId', protect, addToWishlist);
router.delete('/wishlist/:productId', protect, removeFromWishlist);

// Settings routes
router.get('/settings', protect, getSettings);
router.put('/settings', protect, updateSettings);

// Security routes
router.put('/change-password', protect, changePassword);
router.put('/privacy', protect, updatePrivacySettings);
router.delete('/account', protect, deleteAccount);

// Payment methods routes
router.get('/payment-methods', protect, getPaymentMethods);
router.post('/payment-methods', protect, addPaymentMethod);
router.delete('/payment-methods/:id', protect, deletePaymentMethod);

// Admin routes
router.get('/', protect, authorize('admin'), getUsers);
router.get('/:id', protect, authorize('admin'), getUserById);
router.put('/:id', protect, authorize('admin'), updateUser);
router.delete('/:id', protect, authorize('admin'), deleteUser);

export default router;
