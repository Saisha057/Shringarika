import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../config/supabase.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized to access this route. Please login.',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      console.log('🔑 Token decoded, user ID:', decoded.id, 'Role from token:', decoded.role);
      
      // Get user from Supabase using admin client (service role key) to bypass RLS
      const supabase = getSupabaseAdmin();
      const decodedUserId = decoded.userId || decoded.sub || decoded.id;
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, role, is_admin, password_hash')
        .eq('id', decodedUserId)
        .maybeSingle();
      
      if (error) {
        console.error('[AuthMiddleware] DB error during user lookup:', error.message);
      }

      if (!user) {
        console.error('[AuthMiddleware] User not found in DB for id:', decodedUserId);

        if (decoded.role === 'admin' || decoded.isAdmin === true) {
          console.warn('[AuthMiddleware] User not in DB but JWT claims admin role - allowing');
          req.user = {
            id: decodedUserId,
            email: decoded.email,
            role: 'admin',
            is_admin: true,
          };
          return next();
        }

        return res.status(401).json({
          status: 'error',
          message: 'User no longer exists. Please login again.',
        });
      }

      // Remove password from user object
      delete user.password_hash;
      
      req.user = user;

      // NOTE: is_active check disabled - column doesn't exist in database yet
      // if (req.user.is_active === false) {
      //   return res.status(401).json({
      //     status: 'error',
      //     message: 'User account is deactivated',
      //   });
      // }

      console.log('✅ User authenticated:', user.email);
      next();
    } catch (error) {
      console.error('❌ Token verification error:', error.message);
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, token failed',
      });
    }
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('🔐 Authorization check:');
    console.log('   Required roles:', roles);
    console.log('   User role:', req.user?.role);
    console.log('   User email:', req.user?.email);
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `User role '${req.user.role}' is not authorized to access this route. Required: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

// Admin middleware - shorthand for authorize('admin')
export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. Admin privileges required.',
    });
  }
};

// Optional protect - allows guest users to proceed without authentication
export const optionalProtect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies.token) {
      token = req.cookies.token;
    }

    // If no token, allow as guest
    if (!token) {
      console.log('👤 Guest user (no token)');
      req.user = null;
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from Supabase using admin client (service role key) to bypass RLS
      const supabase = getSupabaseAdmin();
      const decodedUserId = decoded.userId || decoded.sub || decoded.id;
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', decodedUserId)
        .maybeSingle();
      
      if (error || !user) {
        // Token invalid, proceed as guest
        console.log('👤 Guest user (invalid token)');
        req.user = null;
        return next();
      }

      // Remove password from user object
      delete user.password_hash;
      req.user = user;
      console.log('✅ User authenticated:', user.email);
      next();
    } catch (error) {
      // Token verification failed, proceed as guest
      console.log('👤 Guest user (token verification failed)');
      req.user = null;
      next();
    }
  } catch (error) {
    next(error);
  }
};
