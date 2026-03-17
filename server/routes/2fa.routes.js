/**
 * Two-Factor Authentication (2FA) Routes
 * 
 * Endpoints:
 * - POST /api/2fa/setup - Generate 2FA secret and QR code
 * - POST /api/2fa/enable - Enable 2FA after verification
 * - POST /api/2fa/disable - Disable 2FA
 * - POST /api/2fa/verify - Verify 2FA token
 * - POST /api/2fa/verify-backup - Verify backup code
 * - GET /api/2fa/backup-codes - Get new backup codes
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  generate2FASecret,
  verify2FAToken,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  limit2FAAttempts
} from '../middleware/2fa.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/2fa/setup
 * @desc    Generate 2FA secret and QR code for user
 * @access  Private
 */
router.post('/setup', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const userName = req.user.name;
    
    // Check if 2FA is already enabled
    if (req.user.two_factor_enabled) {
      return res.status(400).json({
        status: 'error',
        message: '2FA is already enabled. Disable it first to setup again.'
      });
    }
    
    // Generate secret and QR code
    const { secret, qrCode, otpauthUrl } = await generate2FASecret(userEmail, userName);
    
    // Store secret temporarily (not enabled yet)
    const { error } = await supabase
      .from('users')
      .update({
        two_factor_secret: secret,
        two_factor_enabled: false
      })
      .eq('id', userId);
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      status: 'success',
      message: '2FA setup initiated. Scan QR code with authenticator app.',
      data: {
        secret: secret,
        qrCode: qrCode,
        otpauthUrl: otpauthUrl
      }
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error setting up 2FA'
    });
  }
});

/**
 * @route   POST /api/2fa/enable
 * @desc    Enable 2FA after verifying token
 * @access  Private
 */
router.post('/enable', protect, limit2FAAttempts, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Verification token is required'
      });
    }
    
    // Get user's 2FA secret
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('two_factor_secret, two_factor_enabled')
      .eq('id', userId)
      .single();
    
    if (fetchError || !userData) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    if (userData.two_factor_enabled) {
      return res.status(400).json({
        status: 'error',
        message: '2FA is already enabled'
      });
    }
    
    if (!userData.two_factor_secret) {
      return res.status(400).json({
        status: 'error',
        message: 'Please setup 2FA first'
      });
    }
    
    // Verify token
    const isValid = verify2FAToken(userData.two_factor_secret, token);
    
    if (!isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid verification token'
      });
    }
    
    // Generate backup codes
    const backupCodes = generateBackupCodes(10);
    const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));
    
    // Enable 2FA
    const { error } = await supabase
      .from('users')
      .update({
        two_factor_enabled: true,
        two_factor_backup_codes: hashedBackupCodes
      })
      .eq('id', userId);
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      status: 'success',
      message: '2FA enabled successfully. Save your backup codes in a safe place.',
      data: {
        backupCodes: backupCodes
      }
    });
  } catch (error) {
    console.error('2FA enable error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error enabling 2FA'
    });
  }
});

/**
 * @route   POST /api/2fa/disable
 * @desc    Disable 2FA
 * @access  Private
 */
router.post('/disable', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, token } = req.body;
    
    if (!password) {
      return res.status(400).json({
        status: 'error',
        message: 'Password is required to disable 2FA'
      });
    }
    
    // Verify password
    const bcrypt = await import('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, req.user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid password'
      });
    }
    
    // If 2FA is enabled, verify token
    if (req.user.two_factor_enabled) {
      if (!token) {
        return res.status(400).json({
          status: 'error',
          message: '2FA token is required'
        });
      }
      
      const isValid = verify2FAToken(req.user.two_factor_secret, token);
      
      if (!isValid) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid 2FA token'
        });
      }
    }
    
    // Disable 2FA
    const { error } = await supabase
      .from('users')
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_backup_codes: null
      })
      .eq('id', userId);
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      status: 'success',
      message: '2FA disabled successfully'
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error disabling 2FA'
    });
  }
});

/**
 * @route   POST /api/2fa/verify
 * @desc    Verify 2FA token during login
 * @access  Public (but requires valid auth token)
 */
router.post('/verify', protect, limit2FAAttempts, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Verification token is required'
      });
    }
    
    // Verify token
    const isValid = verify2FAToken(req.user.two_factor_secret, token);
    
    if (!isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid verification token'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: '2FA verification successful'
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error verifying 2FA'
    });
  }
});

/**
 * @route   POST /api/2fa/verify-backup
 * @desc    Verify backup code during login
 * @access  Public (but requires valid auth token)
 */
router.post('/verify-backup', protect, limit2FAAttempts, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        status: 'error',
        message: 'Backup code is required'
      });
    }
    
    // Get backup codes
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('two_factor_backup_codes')
      .eq('id', userId)
      .single();
    
    if (fetchError || !userData) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    const backupCodes = userData.two_factor_backup_codes || [];
    
    // Verify backup code
    const isValid = verifyBackupCode(code, backupCodes);
    
    if (!isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid backup code'
      });
    }
    
    // Remove used backup code
    const hashedCode = hashBackupCode(code);
    const updatedCodes = backupCodes.filter(c => c !== hashedCode);
    
    await supabase
      .from('users')
      .update({ two_factor_backup_codes: updatedCodes })
      .eq('id', userId);
    
    res.status(200).json({
      status: 'success',
      message: 'Backup code verified successfully',
      remainingCodes: updatedCodes.length
    });
  } catch (error) {
    console.error('2FA backup verify error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error verifying backup code'
    });
  }
});

/**
 * @route   GET /api/2fa/backup-codes
 * @desc    Generate new backup codes
 * @access  Private
 */
router.get('/backup-codes', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if 2FA is enabled
    if (!req.user.two_factor_enabled) {
      return res.status(400).json({
        status: 'error',
        message: '2FA must be enabled to generate backup codes'
      });
    }
    
    // Generate new backup codes
    const backupCodes = generateBackupCodes(10);
    const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));
    
    // Update backup codes
    const { error } = await supabase
      .from('users')
      .update({ two_factor_backup_codes: hashedBackupCodes })
      .eq('id', userId);
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      status: 'success',
      message: 'New backup codes generated. Save them in a safe place.',
      data: {
        backupCodes: backupCodes
      }
    });
  } catch (error) {
    console.error('2FA backup codes error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating backup codes'
    });
  }
});

/**
 * @route   GET /api/2fa/status
 * @desc    Get 2FA status
 * @access  Private
 */
router.get('/status', protect, async (req, res) => {
  try {
    res.status(200).json({
      status: 'success',
      data: {
        enabled: req.user.two_factor_enabled || false,
        hasBackupCodes: (req.user.two_factor_backup_codes?.length || 0) > 0
      }
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error getting 2FA status'
    });
  }
});

export default router;
