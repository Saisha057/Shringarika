import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '../config/supabase.js';
import { sendEmail, getWelcomeEmailTemplate } from '../utils/sendEmail.js';

// Generate JWT token with user email and role
const generateToken = (userId, email, role) => {
  return jwt.sign(
    { 
      id: userId, 
      email: email,
      role: role 
    }, 
    process.env.JWT_SECRET, 
    {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    }
  );
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    const supabase = getSupabaseAdmin();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Email already registered',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in Supabase
    let user;
    let error;

    // Prefer the current schema used by the app (name/phone/password).
    // Fall back to the legacy schema when the deployment database has not been migrated.
    ({ data: user, error } = await supabase
      .from('users')
      .insert([
        {
          name: name || email,
          email,
          phone: phone || null,
          password: hashedPassword,
          role: 'customer',
          is_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single());

    if (error) {
      const fallbackToLegacySchema = /column .*password|column .*name|column .*phone/i.test(error.message || '');

      if (!fallbackToLegacySchema) {
        console.error('Supabase registration error:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to create account',
          error: error.message,
        });
      }

      ({ data: user, error } = await supabase
        .from('users')
        .insert([
          {
            email,
            password_hash: hashedPassword,
            role: 'customer',
            is_active: true,
            is_verified: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single());
    }

    if (error) {
      console.error('Supabase registration error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create account',
        error: error.message,
      });
    }

    // Create profile for user with name and phone
    try {
      await supabase
        .from('profiles')
        .insert([{
          user_id: user.id,
          first_name: name || '',
          phone: phone || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
    } catch (profileError) {
      console.error('Failed to create profile:', profileError);
    }

    // Send welcome email (non-blocking)
    try {
      await sendEmail({
        email: user.email,
        subject: 'Welcome to Shringarika',
        html: getWelcomeEmailTemplate(name || user.email),
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // Generate token with user info
    const token = generateToken(user.id, user.email, user.role);

    // Remove password fields from response and add name
    delete user.password_hash;
    delete user.password;
    user.name = name || user.email;

    res.status(201).json({
      status: 'success',
      token,
      user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    // Validate email & password
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password',
      });
    }

    const supabase = getSupabaseAdmin();

    // Get user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.log('❌ Database error:', error.message);
    }

    if (error || !user) {
      console.log('❌ User not found for email:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    console.log('✅ User found:', user.email, 'Role:', user.role);

    // Check password from whichever schema the deployment uses
    const storedPassword = user.password || user.password_hash;

    if (!storedPassword) {
      console.error('Authentication schema mismatch: users table is missing a password field');
      return res.status(500).json({
        status: 'error',
        message: 'Authentication schema is not configured correctly',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, storedPassword);

    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    // Get profile info if available
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('user_id', user.id)
      .single();

    // Update last_login timestamp
    try {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', user.id);
      console.log(`✅ User login tracked: ${user.email} at ${new Date().toISOString()}`);
    } catch (err) {
      console.error('Failed to track login:', err);
      // Don't fail the login if tracking fails
    }

    // Generate token with user info
    const token = generateToken(user.id, user.email, user.role);

    // Remove password from response and add profile info
    delete user.password_hash;
    delete user.password;
    
    // Add name from profile or use email
    if (profile) {
      user.name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email;
      user.phone = profile.phone;
    } else {
      user.name = user.email;
    }

    console.log('✅ User logged in:', user.email, 'Role:', user.role);

    res.status(200).json({
      status: 'success',
      token,
      user,
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const supabase = getSupabaseAdmin();

    // Normalize email to lowercase for consistent lookup
    const normalizedEmail = email.toLowerCase().trim();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', normalizedEmail)
      .single();

    if (error || !user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        status: 'success',
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save reset token (expires in 10 minutes)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_password_token: resetTokenHash,
        reset_password_expire: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to save reset token:', updateError);
      return res.status(200).json({
        status: 'success',
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Create reset URL - point to frontend with token as query param
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}?reset=${resetToken}`;
    
    console.log('🔗 Password Reset URL generated:', resetUrl);
    console.log('📧 Sending to:', user.email);

    // Send email
    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Request - Shringarika',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px;">Password Reset Request</h1>
            
            <p style="font-size: 16px; color: #333; margin: 20px 0;">Hello,</p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              We received a request to reset the password for your Shringarika account associated with <strong>${user.email}</strong>.
            </p>

            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              If this was you, please click the button below to reset your password:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                RESET PASSWORD
              </a>
            </div>

            <p style="font-size: 14px; color: #666; line-height: 1.6;">
              Or copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #000; word-break: break-all;">${resetUrl}</a>
            </p>

            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                ⚠️ <strong>Important:</strong> This link will expire in 10 minutes for security reasons.
              </p>
            </div>

            <p style="font-size: 14px; color: #666; line-height: 1.6;">
              <strong>If you didn't request this password reset,</strong> please ignore this email and your password will remain unchanged. Your account is secure.
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
              © 2025 Shringarika. All rights reserved.<br>
              This is an automated email, please do not reply.
            </p>
          </div>
        `,
      });

      res.status(200).json({
        status: 'success',
        message: 'Email sent',
      });
    } catch (error) {
      console.error('Email send error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Email could not be sent',
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resetToken
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(req.params.resetToken)
      .digest('hex');

    const supabase = getSupabaseAdmin();

    // Find user with valid reset token
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('reset_password_token', resetTokenHash)
      .gt('reset_password_expire', new Date().toISOString())
      .single();

    if (error || !user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // Update password and clear reset token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        reset_password_token: null,
        reset_password_expire: null,
      })
      .eq('id', user.id);

    if (updateError) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to reset password',
      });
    }

    // Generate new token
    const token = generateToken(user.id);

    res.status(200).json({
      status: 'success',
      token,
    });
  } catch (error) {
    next(error);
  }
};
