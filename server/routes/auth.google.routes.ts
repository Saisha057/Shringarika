/**
 * Google OAuth Routes
 * POST /api/auth/google - Authenticate user with Google ID token
 */

import { Router } from 'express';
import { googleAuth } from '../controllers/auth.google.controller';

const router = Router();

// Google OAuth authentication
router.post('/google', googleAuth);

export default router;
