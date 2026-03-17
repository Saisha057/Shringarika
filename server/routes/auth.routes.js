import express from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.supabase.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { validateCsrfToken } from '../middleware/csrf.middleware.js';
import { checkRecaptcha } from '../middleware/recaptcha.middleware.js';

const router = express.Router();

// Validation rules
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }).withMessage('Name must not exceed 50 characters'),
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
];

const resetPasswordValidation = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const updatePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

// Routes (CSRF disabled for auth endpoints - using other security measures)
router.post('/register', registerValidation, validate, checkRecaptcha, register);
router.post('/login', loginValidation, validate, checkRecaptcha, login);
router.get('/logout', logout);
router.get('/me', protect, getMe);
router.post('/forgotpassword', forgotPasswordValidation, validate, checkRecaptcha, forgotPassword);
router.get('/validate-reset-token/:token', async (req, res) => {
  try {
    const crypto = require('crypto');
    const resetTokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const { getSupabase } = require('../config/supabase.config');
    const supabase = getSupabase();

    const { data: user, error } = await supabase
      .from('users')
      .select('email, reset_password_expire')
      .eq('reset_password_token', resetTokenHash)
      .single();

    if (error || !user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token',
      });
    }

    // Check if token is expired
    if (new Date(user.reset_password_expire) < new Date()) {
      return res.status(400).json({
        status: 'error',
        message: 'Reset token has expired',
      });
    }

    res.status(200).json({
      status: 'success',
      email: user.email,
      message: 'Token is valid',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to validate token',
    });
  }
});
router.put('/resetpassword/:resettoken', resetPasswordValidation, validate, resetPassword);

export default router;
