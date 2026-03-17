/**
 * Session Management Routes
 * 
 * Endpoints:
 * - GET /api/sessions - Get active sessions
 * - DELETE /api/sessions/:id - Invalidate specific session
 * - DELETE /api/sessions - Invalidate all sessions except current
 * - POST /api/sessions/logout-all - Logout from all devices except current
 */

import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  getActiveSessions,
  invalidateSession,
  invalidateAllSessions
} from '../middleware/session.middleware.js';
import {
  logoutAllDevices,
  logoutFromDevice,
} from '../controllers/sessionSecurity.controller.js';

const router = express.Router();

/**
 * @route   GET /api/sessions
 * @desc    Get user's active sessions
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const sessions = await getActiveSessions(req.user.id);
    
    res.status(200).json({
      status: 'success',
      count: sessions.length,
      data: sessions
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving sessions'
    });
  }
});

/**
 * @route   DELETE /api/sessions/:id
 * @desc    Invalidate specific session (logout from device)
 * @access  Private
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    await invalidateSession(sessionId, req.user.id);
    
    res.status(200).json({
      status: 'success',
      message: 'Session invalidated successfully'
    });
  } catch (error) {
    console.error('Invalidate session error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error invalidating session'
    });
  }
});

/**
 * @route   DELETE /api/sessions
 * @desc    Invalidate all sessions except current (logout all devices)
 * @access  Private
 */
router.delete('/', protect, async (req, res) => {
  try {
    // Get current session ID from token
    const currentSessionId = req.session?.id;
    
    await invalidateAllSessions(req.user.id, currentSessionId);
    
    res.status(200).json({
      status: 'success',
      message: 'All other sessions invalidated successfully'
    });
  } catch (error) {
    console.error('Invalidate all sessions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error invalidating sessions'
    });
  }
});

export default router;
