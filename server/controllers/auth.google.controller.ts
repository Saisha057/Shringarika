/**
 * Google OAuth Authentication Controller
 * Handles Google Sign-In integration for user authentication
 */

import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { getSupabaseAdmin } from '../config/supabase.admin';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Google ID Token and create/login user
 * POST /api/auth/google
 */
export async function googleAuth(req: Request, res: Response) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const { email, name, picture, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google' });
    }

    const supabase = getSupabaseAdmin();

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    let user;

    if (existingUser) {
      // User exists - update last login and Google ID if not set
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          google_id: googleId,
          profile_picture: picture || existingUser.profile_picture,
          last_login: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user:', updateError);
        return res.status(500).json({ error: 'Failed to update user' });
      }

      user = updatedUser;
      console.log('✅ Existing user logged in via Google:', email);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email,
          name: name || email.split('@')[0],
          google_id: googleId,
          profile_picture: picture,
          email_verified: true, // Google emails are pre-verified
          role: 'customer',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return res.status(500).json({ error: 'Failed to create user account' });
      }

      user = newUser;
      console.log('✅ New user created via Google:', email);
    }

    // Generate JWT token
    const secret: Secret =
      process.env.JWT_SECRET ?? 'fallback_secret';

    const options: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRE ?? '7d') as SignOptions['expiresIn'],
    };

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      secret,
      options
    );

    // Return user data and token
    return res.status(200).json({
      success: true,
      message: existingUser ? 'Login successful' : 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profile_picture: user.profile_picture,
      },
      token,
    });
  } catch (error: any) {
    console.error('❌ Google OAuth error:', error);
    
    if (error.message?.includes('Token used too late')) {
      return res.status(401).json({ error: 'Google token expired. Please try again.' });
    }
    
    return res.status(500).json({ error: 'Google authentication failed' });
  }
}
