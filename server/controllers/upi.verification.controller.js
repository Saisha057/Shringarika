import crypto from 'crypto';
import axios from 'axios';

/**
 * UPI ID VERIFICATION CONTROLLER
 * 
 * Implements real VPA (Virtual Payment Address) verification using payment gateway APIs
 * Primary: Razorpay Fund Account Validation API
 * Fallback: Cashfree Beneficiary Verification API
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Razorpay Configuration
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    baseURL: 'https://api.razorpay.com/v1',
    // VPA validation endpoint
    validateURL: 'https://api.razorpay.com/v1/fund_accounts/validations'
  },
  
  // Cashfree Configuration (Fallback)
  cashfree: {
    appId: process.env.CASHFREE_APP_ID,
    secretKey: process.env.CASHFREE_SECRET_KEY,
    baseURL: process.env.CASHFREE_ENV === 'production' 
      ? 'https://api.cashfree.com/verification/bankdetails'
      : 'https://test.cashfree.com/verification/bankdetails'
  },
  
  // Rate Limiting
  rateLimit: {
    maxAttemptsPerHour: 10, // per IP
    maxAttemptsPerUser: 20, // per user per day
    blockDurationMinutes: 30
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Validate UPI ID format (client-side validation)
 */
export function validateUPIFormat(upiId) {
  if (!upiId || typeof upiId !== 'string') {
    return { valid: false, error: 'UPI ID is required' };
  }

  // Trim and lowercase
  upiId = upiId.trim().toLowerCase();

  // Must contain exactly one "@"
  if (!upiId.includes('@') || upiId.split('@').length !== 2) {
    return { valid: false, error: 'UPI ID must contain exactly one @ symbol' };
  }

  const [username, handle] = upiId.split('@');

  // Username validation
  if (username.length < 2) {
    return { valid: false, error: 'Username must be at least 2 characters' };
  }

  // Handle validation
  if (handle.length < 3) {
    return { valid: false, error: 'Handle must be at least 3 characters' };
  }

  // Character validation
  const usernameRegex = /^[a-z0-9._-]+$/;
  const handleRegex = /^[a-z0-9.-]+$/;

  if (!usernameRegex.test(username)) {
    return { valid: false, error: 'Username can only contain lowercase letters, numbers, dots, underscores, and hyphens' };
  }

  if (!handleRegex.test(handle)) {
    return { valid: false, error: 'Handle can only contain lowercase letters, numbers, dots, and hyphens' };
  }

  // No spaces allowed
  if (upiId.includes(' ')) {
    return { valid: false, error: 'UPI ID cannot contain spaces' };
  }

  return { valid: true, upiId };
}

/**
 * Check rate limiting
 */
async function checkRateLimit(identifier, identifierType, supabase) {
  try {
    const { data, error } = await supabase
      .from('upi_verification_rate_limit')
      .select('*')
      .eq('identifier', identifier)
      .eq('identifier_type', identifierType)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Rate limit check error:', error);
      return { allowed: true }; // Fail open to prevent blocking legitimate users
    }

    if (!data) {
      // First attempt
      return { allowed: true, isNew: true };
    }

    // Check if blocked
    if (data.blocked_until && new Date(data.blocked_until) > new Date()) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        retryAfter: data.blocked_until
      };
    }

    // Check window
    const windowStart = new Date(data.window_start);
    const now = new Date();
    const hoursSinceStart = (now - windowStart) / (1000 * 60 * 60);

    if (hoursSinceStart > 1) {
      // Reset window
      return { allowed: true, shouldReset: true };
    }

    // Check attempt count
    const limit = identifierType === 'ip' 
      ? CONFIG.rateLimit.maxAttemptsPerHour 
      : CONFIG.rateLimit.maxAttemptsPerUser;

    if (data.attempt_count >= limit) {
      // Block for configured duration
      const blockedUntil = new Date(now.getTime() + CONFIG.rateLimit.blockDurationMinutes * 60000);
      
      await supabase
        .from('upi_verification_rate_limit')
        .update({ blocked_until: blockedUntil.toISOString() })
        .eq('identifier', identifier)
        .eq('identifier_type', identifierType);

      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        retryAfter: blockedUntil.toISOString()
      };
    }

    return { allowed: true, currentCount: data.attempt_count };
  } catch (error) {
    console.error('Rate limit check exception:', error);
    return { allowed: true }; // Fail open
  }
}

/**
 * Update rate limit counter
 */
async function updateRateLimit(identifier, identifierType, supabase, shouldReset = false) {
  try {
    if (shouldReset) {
      await supabase
        .from('upi_verification_rate_limit')
        .upsert({
          identifier,
          identifier_type: identifierType,
          attempt_count: 1,
          window_start: new Date().toISOString()
        }, { onConflict: 'identifier,identifier_type' });
    } else {
      const { data: existing } = await supabase
        .from('upi_verification_rate_limit')
        .select('attempt_count')
        .eq('identifier', identifier)
        .eq('identifier_type', identifierType)
        .single();

      if (existing) {
        await supabase
          .from('upi_verification_rate_limit')
          .update({ attempt_count: existing.attempt_count + 1 })
          .eq('identifier', identifier)
          .eq('identifier_type', identifierType);
      } else {
        await supabase
          .from('upi_verification_rate_limit')
          .insert({
            identifier,
            identifier_type: identifierType,
            attempt_count: 1,
            window_start: new Date().toISOString()
          });
      }
    }
  } catch (error) {
    console.error('Rate limit update error:', error);
  }
}

// ============================================
// PAYMENT GATEWAY INTEGRATION
// ============================================

/**
 * Verify UPI ID using Razorpay Fund Account Validation API
 * Docs: https://razorpay.com/docs/api/fund-accounts/validations/
 */
async function verifyWithRazorpay(upiId) {
  try {
    if (!CONFIG.razorpay.keyId || !CONFIG.razorpay.keySecret) {
      return {
        success: false,
        error: 'RAZORPAY_NOT_CONFIGURED',
        message: 'Razorpay credentials not configured'
      };
    }

    // Create auth header
    const auth = Buffer.from(`${CONFIG.razorpay.keyId}:${CONFIG.razorpay.keySecret}`).toString('base64');

    // Step 1: Create fund account
    const fundAccountResponse = await axios.post(
      `${CONFIG.razorpay.baseURL}/fund_accounts`,
      {
        contact_id: 'cont_test', // Optional: can create contact first
        account_type: 'vpa',
        vpa: {
          address: upiId
        }
      },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const fundAccountId = fundAccountResponse.data.id;

    // Step 2: Validate fund account (actual verification)
    const validationResponse = await axios.post(
      CONFIG.razorpay.validateURL,
      {
        fund_account: {
          id: fundAccountId
        },
        amount: 100, // Minimum amount in paise (₹1)
        currency: 'INR',
        notes: {
          purpose: 'UPI_VERIFICATION'
        }
      },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const validation = validationResponse.data;

    // Check validation status
    if (validation.status === 'completed' && validation.results && validation.results.account_status === 'active') {
      return {
        success: true,
        valid: true,
        verifiedName: validation.results.registered_name || null,
        provider: 'razorpay',
        providerReferenceId: validation.id,
        fundAccountId: fundAccountId,
        rawResponse: validation
      };
    } else {
      return {
        success: true,
        valid: false,
        errorReason: validation.results?.account_status || 'INVALID_UPI_ID',
        provider: 'razorpay',
        providerReferenceId: validation.id,
        rawResponse: validation
      };
    }
  } catch (error) {
    console.error('Razorpay verification error:', error.response?.data || error.message);
    
    // Check if it's an invalid UPI error
    if (error.response?.data?.error?.code === 'BAD_REQUEST_ERROR') {
      return {
        success: true,
        valid: false,
        errorReason: 'INVALID_UPI_ID',
        provider: 'razorpay',
        error: error.response.data.error.description
      };
    }

    return {
      success: false,
      error: 'RAZORPAY_API_ERROR',
      message: error.response?.data?.error?.description || error.message
    };
  }
}

/**
 * Verify UPI ID using Cashfree Beneficiary Verification (Fallback)
 * Docs: https://docs.cashfree.com/reference/verify-upi
 */
async function verifyWithCashfree(upiId) {
  try {
    if (!CONFIG.cashfree.appId || !CONFIG.cashfree.secretKey) {
      return {
        success: false,
        error: 'CASHFREE_NOT_CONFIGURED',
        message: 'Cashfree credentials not configured'
      };
    }

    const response = await axios.post(
      `${CONFIG.cashfree.baseURL}/upi`,
      {
        vpa: upiId,
        name: '' // Optional verification
      },
      {
        headers: {
          'x-client-id': CONFIG.cashfree.appId,
          'x-client-secret': CONFIG.cashfree.secretKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const result = response.data;

    if (result.valid === true || result.status === 'VALID') {
      return {
        success: true,
        valid: true,
        verifiedName: result.name_at_bank || result.registered_name || null,
        provider: 'cashfree',
        providerReferenceId: result.reference_id || result.request_id,
        rawResponse: result
      };
    } else {
      return {
        success: true,
        valid: false,
        errorReason: result.reason || 'INVALID_UPI_ID',
        provider: 'cashfree',
        rawResponse: result
      };
    }
  } catch (error) {
    console.error('Cashfree verification error:', error.response?.data || error.message);
    return {
      success: false,
      error: 'CASHFREE_API_ERROR',
      message: error.response?.data?.message || error.message
    };
  }
}

// ============================================
// MAIN CONTROLLER FUNCTIONS
// ============================================

/**
 * Verify UPI ID - Main endpoint handler
 * POST /api/upi/verify
 */
export async function verifyUPIController(req, res, supabase) {
  try {
    const { upiId, context = 'payment', orderId = null } = req.body;
    const userId = req.user?.id || null;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    console.log('[UPI-VERIFY] Request received:', { upiId, context, userId, ipAddress });

    // Step 1: Format validation
    const formatCheck = validateUPIFormat(upiId);
    if (!formatCheck.valid) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_FORMAT',
        message: formatCheck.error
      });
    }

    const normalizedUpiId = formatCheck.upiId;

    // Step 2: Rate limiting
    const ipRateLimit = await checkRateLimit(ipAddress, 'ip', supabase);
    if (!ipRateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many verification attempts. Please try again later.',
        retryAfter: ipRateLimit.retryAfter
      });
    }

    if (userId) {
      const userRateLimit = await checkRateLimit(userId, 'user_id', supabase);
      if (!userRateLimit.allowed) {
        return res.status(429).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many verification attempts. Please try again later.',
          retryAfter: userRateLimit.retryAfter
        });
      }
    }

    // Step 3: Check if already verified recently (cache)
    const { data: recentVerification } = await supabase
      .from('upi_verifications')
      .select('*')
      .eq('upi_id', normalizedUpiId)
      .eq('status', 'verified')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentVerification) {
      console.log('[UPI-VERIFY] Using cached verification');
      return res.json({
        success: true,
        valid: true,
        upiId: normalizedUpiId,
        verifiedName: recentVerification.verified_name,
        provider: recentVerification.provider,
        providerReferenceId: recentVerification.provider_reference_id,
        verifiedAt: recentVerification.created_at,
        cached: true
      });
    }

    // Step 4: Perform actual verification via payment gateway
    console.log('[UPI-VERIFY] Calling payment gateway...');
    
    let verificationResult = await verifyWithRazorpay(normalizedUpiId);
    
    // Fallback to Cashfree if Razorpay fails
    if (!verificationResult.success) {
      console.log('[UPI-VERIFY] Razorpay failed, trying Cashfree...');
      verificationResult = await verifyWithCashfree(normalizedUpiId);
    }

    // Step 5: Update rate limits
    await updateRateLimit(ipAddress, 'ip', supabase, ipRateLimit.shouldReset);
    if (userId) {
      await updateRateLimit(userId, 'user_id', supabase, false);
    }

    // Step 6: Store verification result in database
    const verificationRecord = {
      user_id: userId,
      order_id: orderId,
      upi_id: normalizedUpiId,
      status: verificationResult.valid ? 'verified' : 'failed',
      verified_name: verificationResult.verifiedName || null,
      provider: verificationResult.provider || 'unknown',
      provider_reference_id: verificationResult.providerReferenceId || null,
      raw_response: verificationResult.rawResponse || null,
      ip_address: ipAddress,
      context: context,
      error_reason: verificationResult.errorReason || null
    };

    const { data: savedRecord, error: saveError } = await supabase
      .from('upi_verifications')
      .insert(verificationRecord)
      .select()
      .single();

    if (saveError) {
      console.error('[UPI-VERIFY] Database save error:', saveError);
    }

    // Step 7: Return response
    if (verificationResult.valid) {
      return res.json({
        success: true,
        valid: true,
        upiId: normalizedUpiId,
        verifiedName: verificationResult.verifiedName,
        provider: verificationResult.provider,
        providerReferenceId: verificationResult.providerReferenceId,
        verifiedAt: new Date().toISOString(),
        verificationId: savedRecord?.id
      });
    } else {
      return res.json({
        success: true,
        valid: false,
        upiId: normalizedUpiId,
        errorReason: verificationResult.errorReason || 'INVALID_UPI_ID',
        provider: verificationResult.provider
      });
    }
  } catch (error) {
    console.error('[UPI-VERIFY] Controller error:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to verify UPI ID. Please try again.'
    });
  }
}

/**
 * Client-side format validation endpoint (fast response, no gateway call)
 * POST /api/upi/validate-format
 */
export function validateUPIFormatController(req, res) {
  const { upiId } = req.body;
  const result = validateUPIFormat(upiId);
  
  if (result.valid) {
    return res.json({
      success: true,
      valid: true,
      upiId: result.upiId
    });
  } else {
    return res.status(400).json({
      success: false,
      valid: false,
      error: result.error
    });
  }
}
