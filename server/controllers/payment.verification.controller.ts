// ============================================================================
// Payment Verification Controller
// ============================================================================
// Purpose: Secure verification of UPI IDs and Bank Accounts
// APIs: Mock implementation (replace with Razorpay/Cashfree/Decentro)
// ============================================================================

import { Request, Response } from 'express';
import { getSupabaseAdmin } from '../config/supabase.admin';
import {
  verifyUpiSchema,
  verifyBankSchema,
  savePaymentMethodSchema,
  updatePaymentMethodSchema,
  sanitizeUpiId,
  sanitizeIfsc,
  sanitizeAccountNumber,
} from '../validators/payment.validation';

// ============================================================================
// MOCK VERIFICATION API (Replace with real API)
// ============================================================================

interface MockUpiVerificationResponse {
  success: boolean;
  upi_id: string;
  registered_name: string | null;
  error?: string;
}

interface MockBankVerificationResponse {
  success: boolean;
  account_number: string;
  ifsc: string;
  account_holder_name: string | null;
  bank_name?: string;
  error?: string;
}

async function mockVerifyUpi(upiId: string): Promise<MockUpiVerificationResponse> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Mock validation: Accept if UPI ID contains specific patterns
  const validPatterns = ['paytm', 'gpay', 'phonepe', 'ybl', 'oksbi'];
  const isValid = validPatterns.some((pattern) => upiId.includes(pattern));

  if (isValid) {
    // Extract username from UPI ID (part before @)
    const username = upiId.split('@')[0].replace(/[._-]/g, ' ');
    return {
      success: true,
      upi_id: upiId,
      registered_name: `${username} (Verified)`.toUpperCase(),
    };
  }

  return {
    success: false,
    upi_id: upiId,
    registered_name: null,
    error: 'UPI ID not found or inactive',
  };
}

async function mockVerifyBank(
  accountNumber: string,
  ifsc: string
): Promise<MockBankVerificationResponse> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Mock validation: Accept if account number starts with valid digits
  const validStartDigits = ['1', '2', '3', '5', '6', '9'];
  const isValid = validStartDigits.includes(accountNumber[0]);

  if (isValid) {
    const bankCode = ifsc.substring(0, 4);
    const bankNames: Record<string, string> = {
      SBIN: 'State Bank of India',
      HDFC: 'HDFC Bank',
      ICIC: 'ICICI Bank',
      UTIB: 'Axis Bank',
      KKBK: 'Kotak Mahindra Bank',
    };

    return {
      success: true,
      account_number: accountNumber,
      ifsc: ifsc,
      account_holder_name: 'ACCOUNT HOLDER NAME (Verified)',
      bank_name: bankNames[bankCode] || 'Unknown Bank',
    };
  }

  return {
    success: false,
    account_number: accountNumber,
    ifsc: ifsc,
    account_holder_name: null,
    error: 'Invalid account number or IFSC code',
  };
}

// ============================================================================
// CONTROLLER: Verify UPI ID
// ============================================================================

export async function verifyUpi(req: Request, res: Response) {
  try {
    const supabase = getSupabaseAdmin();
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate input
    const validation = verifyUpiSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { upi_id } = validation.data;
    const sanitizedUpiId = sanitizeUpiId(upi_id);

    // Check rate limiting
    const { data: rateLimitData, error: rateLimitError } = await supabase.rpc(
      'check_verification_rate_limit',
      {
        p_user_id: userId,
        max_attempts: 5,
        time_window: 60, // 1 hour
      }
    );

    if (rateLimitError) {
      console.error('Rate limit check failed:', rateLimitError);
      return res.status(500).json({ error: 'Rate limit check failed' });
    }

    if (!rateLimitData[0]?.allowed) {
      const resetAt = new Date(rateLimitData[0]?.reset_at);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You have exceeded the maximum verification attempts. Please try again after ${resetAt.toLocaleTimeString()}`,
        attempts_remaining: 0,
        reset_at: resetAt.toISOString(),
      });
    }

    // Call verification API (mock)
    const verificationResult = await mockVerifyUpi(sanitizedUpiId);

    // Log attempt
    const { error: logError } = await supabase.rpc('log_verification_attempt', {
      p_user_id: userId,
      p_type: 'UPI',
      p_identifier: sanitizedUpiId,
      p_ifsc: null,
      p_success: verificationResult.success,
      p_error_message: verificationResult.error || null,
      p_api_response: verificationResult,
      p_ip_address: req.ip || null,
      p_user_agent: req.headers['user-agent'] || null,
    });

    if (logError) {
      console.error('Failed to log verification attempt:', logError);
    }

    // Check name similarity if verification succeeded
    if (verificationResult.success && verificationResult.registered_name) {
      const { data: similarityData } = await supabase.rpc('check_name_similarity', {
        p_user_id: userId,
        p_verified_name: verificationResult.registered_name,
      });

      const similarity = similarityData?.[0];
      if (similarity && similarity.similarity_score < 0.5) {
        return res.status(200).json({
          success: false,
          verified: false,
          message: 'Name mismatch detected',
          warning: `The UPI ID is registered to "${similarity.verified_name}" but your profile shows "${similarity.user_name}". Similarity: ${(similarity.similarity_score * 100).toFixed(0)}%`,
          requires_review: similarity.requires_review,
          upi_id: sanitizedUpiId,
          registered_name: verificationResult.registered_name,
        });
      }
    }

    // Return verification result
    if (verificationResult.success) {
      return res.status(200).json({
        success: true,
        verified: true,
        upi_id: sanitizedUpiId,
        registered_name: verificationResult.registered_name,
        message: 'UPI ID verified successfully',
      });
    } else {
      return res.status(200).json({
        success: false,
        verified: false,
        message: verificationResult.error || 'Verification failed',
        upi_id: sanitizedUpiId,
      });
    }
  } catch (error) {
    console.error('Verify UPI error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// CONTROLLER: Verify Bank Account
// ============================================================================

export async function verifyBank(req: Request, res: Response) {
  try {
    const supabase = getSupabaseAdmin();
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate input
    const validation = verifyBankSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { account_number, ifsc } = validation.data;
    const sanitizedAccountNumber = sanitizeAccountNumber(account_number);
    const sanitizedIfsc = sanitizeIfsc(ifsc);

    // Check rate limiting
    const { data: rateLimitData, error: rateLimitError } = await supabase.rpc(
      'check_verification_rate_limit',
      {
        p_user_id: userId,
        max_attempts: 5,
        time_window: 60,
      }
    );

    if (rateLimitError) {
      console.error('Rate limit check failed:', rateLimitError);
      return res.status(500).json({ error: 'Rate limit check failed' });
    }

    if (!rateLimitData[0]?.allowed) {
      const resetAt = new Date(rateLimitData[0]?.reset_at);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You have exceeded the maximum verification attempts. Please try again after ${resetAt.toLocaleTimeString()}`,
        attempts_remaining: 0,
        reset_at: resetAt.toISOString(),
      });
    }

    // Call verification API (mock)
    const verificationResult = await mockVerifyBank(
      sanitizedAccountNumber,
      sanitizedIfsc
    );

    // Log attempt
    const { error: logError } = await supabase.rpc('log_verification_attempt', {
      p_user_id: userId,
      p_type: 'BANK',
      p_identifier: sanitizedAccountNumber,
      p_ifsc: sanitizedIfsc,
      p_success: verificationResult.success,
      p_error_message: verificationResult.error || null,
      p_api_response: verificationResult,
      p_ip_address: req.ip || null,
      p_user_agent: req.headers['user-agent'] || null,
    });

    if (logError) {
      console.error('Failed to log verification attempt:', logError);
    }

    // Check name similarity if verification succeeded
    if (verificationResult.success && verificationResult.account_holder_name) {
      const { data: similarityData } = await supabase.rpc('check_name_similarity', {
        p_user_id: userId,
        p_verified_name: verificationResult.account_holder_name,
      });

      const similarity = similarityData?.[0];
      if (similarity && similarity.similarity_score < 0.5) {
        return res.status(200).json({
          success: false,
          verified: false,
          message: 'Name mismatch detected',
          warning: `The account is registered to "${similarity.verified_name}" but your profile shows "${similarity.user_name}". Similarity: ${(similarity.similarity_score * 100).toFixed(0)}%`,
          requires_review: similarity.requires_review,
          account_number: sanitizedAccountNumber,
          ifsc: sanitizedIfsc,
          account_holder_name: verificationResult.account_holder_name,
          bank_name: verificationResult.bank_name,
        });
      }
    }

    // Return verification result
    if (verificationResult.success) {
      return res.status(200).json({
        success: true,
        verified: true,
        account_number: sanitizedAccountNumber,
        ifsc: sanitizedIfsc,
        account_holder_name: verificationResult.account_holder_name,
        bank_name: verificationResult.bank_name,
        message: 'Bank account verified successfully',
      });
    } else {
      return res.status(200).json({
        success: false,
        verified: false,
        message: verificationResult.error || 'Verification failed',
        account_number: sanitizedAccountNumber,
        ifsc: sanitizedIfsc,
      });
    }
  } catch (error) {
    console.error('Verify bank error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// CONTROLLER: Save Verified Payment Method
// ============================================================================

export async function savePaymentMethod(req: Request, res: Response) {
  try {
    const supabase = getSupabaseAdmin();
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate input
    const validation = savePaymentMethodSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { type, identifier, ifsc, account_holder_name, is_default } =
      validation.data;

    // Insert payment method
    const { data, error } = await supabase
      .from('user_payment_methods')
      .insert({
        user_id: userId,
        type,
        identifier,
        ifsc: ifsc || null,
        account_holder_name,
        is_verified: true,
        verified_at: new Date().toISOString(),
        verification_provider: 'MOCK_API', // Replace with actual provider
        is_default,
      })
      .select()
      .single();

    if (error) {
      console.error('Save payment method error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      success: true,
      message: 'Payment method saved successfully',
      data,
    });
  } catch (error) {
    console.error('Save payment method error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// CONTROLLER: Get User Payment Methods
// ============================================================================

export async function getPaymentMethods(req: Request, res: Response) {
  try {
    const supabase = getSupabaseAdmin();
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get payment methods error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// CONTROLLER: Update Payment Method
// ============================================================================

export async function updatePaymentMethod(req: Request, res: Response) {
  try {
    const supabase = getSupabaseAdmin();
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate input
    const validation = updatePaymentMethodSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { data, error } = await supabase
      .from('user_payment_methods')
      .update(validation.data)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update payment method error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment method updated successfully',
      data,
    });
  } catch (error) {
    console.error('Update payment method error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// CONTROLLER: Delete Payment Method
// ============================================================================

export async function deletePaymentMethod(req: Request, res: Response) {
  try {
    const supabase = getSupabaseAdmin();
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('user_payment_methods')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Delete payment method error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully',
    });
  } catch (error) {
    console.error('Delete payment method error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
