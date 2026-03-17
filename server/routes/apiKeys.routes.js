/**
 * API Keys Management Routes
 * 
 * Endpoints:
 * - POST /api/keys - Create new API key
 * - GET /api/keys - List user's API keys
 * - PUT /api/keys/:id/rotate - Rotate API key
 * - DELETE /api/keys/:id - Revoke API key
 */

import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  createApiKey,
  rotateApiKey,
  revokeApiKey,
  listApiKeys
} from '../middleware/apiKey.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/keys
 * @desc    Create new API key
 * @access  Private
 */
router.post('/', protect, async (req, res) => {
  try {
    const { name, permissions } = req.body;
    
    if (!name) {
      return res.status(400).json({
        status: 'error',
        message: 'API key name is required'
      });
    }
    
    // Validate permissions
    const validPermissions = ['products:read', 'products:write', 'orders:read', 'orders:write', 'users:read', '*'];
    const requestedPermissions = permissions || ['products:read'];
    
    const invalidPermissions = requestedPermissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid permissions',
        invalidPermissions
      });
    }
    
    // Create API key
    const apiKey = await createApiKey(req.user.id, name, requestedPermissions);
    
    res.status(201).json({
      status: 'success',
      message: 'API key created successfully. Save the key - it will not be shown again!',
      data: apiKey
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating API key'
    });
  }
});

/**
 * @route   GET /api/keys
 * @desc    List user's API keys
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const keys = await listApiKeys(req.user.id);
    
    res.status(200).json({
      status: 'success',
      count: keys.length,
      data: keys
    });
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error listing API keys'
    });
  }
});

/**
 * @route   PUT /api/keys/:id/rotate
 * @desc    Rotate API key
 * @access  Private
 */
router.put('/:id/rotate', protect, async (req, res) => {
  try {
    const keyId = req.params.id;
    
    const rotatedKey = await rotateApiKey(keyId, req.user.id);
    
    res.status(200).json({
      status: 'success',
      message: 'API key rotated successfully. Save the new key - it will not be shown again!',
      data: rotatedKey
    });
  } catch (error) {
    console.error('Rotate API key error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error rotating API key'
    });
  }
});

/**
 * @route   DELETE /api/keys/:id
 * @desc    Revoke API key
 * @access  Private
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const keyId = req.params.id;
    
    const revokedKey = await revokeApiKey(keyId, req.user.id);
    
    res.status(200).json({
      status: 'success',
      message: 'API key revoked successfully',
      data: revokedKey
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error revoking API key'
    });
  }
});

export default router;
