// ============================================================================
// Payment Verification Validation Schemas (Zod)
// ============================================================================
// Purpose: Strict input validation for UPI and Bank verification
// ============================================================================

import { z } from 'zod';

// ============================================================================
// UPI ID VALIDATION SCHEMA
// ============================================================================

// UPI ID format: username@bankcode
// Examples: john.doe@paytm, 9876543210@ybl, merchant@oksbi
const UPI_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z]+$/;

export const verifyUpiSchema = z.object({
  upi_id: z
    .string()
    .trim()
    .min(3, 'UPI ID must be at least 3 characters')
    .max(50, 'UPI ID must not exceed 50 characters')
    .regex(UPI_REGEX, 'Invalid UPI ID format. Example: username@bankcode')
    .transform((val) => val.toLowerCase()), // Normalize to lowercase
});

export type VerifyUpiInput = z.infer<typeof verifyUpiSchema>;

// ============================================================================
// IFSC CODE VALIDATION SCHEMA
// ============================================================================

// IFSC format: First 4 letters (bank code) + 0 + 6 alphanumeric (branch code)
// Examples: SBIN0001234, HDFC0000123, ICIC0001234
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const ifscSchema = z
  .string()
  .trim()
  .length(11, 'IFSC code must be exactly 11 characters')
  .regex(IFSC_REGEX, 'Invalid IFSC code format. Example: SBIN0001234')
  .transform((val) => val.toUpperCase()); // Normalize to uppercase

// ============================================================================
// BANK ACCOUNT VALIDATION SCHEMA
// ============================================================================

export const verifyBankSchema = z.object({
  account_number: z
    .string()
    .trim()
    .min(9, 'Account number must be at least 9 digits')
    .max(18, 'Account number must not exceed 18 digits')
    .regex(/^[0-9]+$/, 'Account number must contain only digits'),
  
  ifsc: ifscSchema,
  
  // Optional: Account holder name for pre-check
  account_holder_name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .regex(
      /^[a-zA-Z\s.'-]+$/,
      'Name must contain only letters, spaces, dots, hyphens, and apostrophes'
    )
    .optional(),
});

export type VerifyBankInput = z.infer<typeof verifyBankSchema>;

// ============================================================================
// SAVE PAYMENT METHOD SCHEMA
// ============================================================================

export const savePaymentMethodSchema = z.object({
  type: z.enum(['UPI', 'BANK']),
  
  identifier: z.string().min(3).max(255),
  
  ifsc: z.string().length(11).regex(IFSC_REGEX).optional(),
  
  account_holder_name: z.string().min(2).max(255),
  
  is_default: z.boolean().default(false),
  
  // Must be verified before saving
  is_verified: z.literal(true, {
    message: 'Payment method must be verified before saving',
  }),
}).refine(
  (data) => data.type === 'UPI' || data.type === 'BANK',
  {
    message: 'Type must be either UPI or BANK',
    path: ['type'],
  }
);

export type SavePaymentMethodInput = z.infer<typeof savePaymentMethodSchema>;

// ============================================================================
// UPDATE PAYMENT METHOD SCHEMA
// ============================================================================

export const updatePaymentMethodSchema = z.object({
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;

// ============================================================================
// REFUND REQUEST SCHEMA (with verified payment method)
// ============================================================================

export const requestRefundSchema = z.object({
  order_id: z.string().uuid('Invalid order ID'),
  
  payment_method_id: z
    .string()
    .uuid('Invalid payment method ID')
    .describe('Must be a verified payment method'),
  
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason must not exceed 500 characters'),
  
  refund_amount: z
    .number()
    .positive('Refund amount must be positive')
    .max(1000000, 'Refund amount exceeds maximum limit'),
});

export type RequestRefundInput = z.infer<typeof requestRefundSchema>;

// ============================================================================
// HELPER: Validate UPI ID format (standalone function)
// ============================================================================

export function isValidUpiId(upiId: string): boolean {
  return UPI_REGEX.test(upiId);
}

// ============================================================================
// HELPER: Validate IFSC code format (standalone function)
// ============================================================================

export function isValidIfsc(ifsc: string): boolean {
  return IFSC_REGEX.test(ifsc);
}

// ============================================================================
// HELPER: Sanitize UPI ID
// ============================================================================

export function sanitizeUpiId(upiId: string): string {
  return upiId.trim().toLowerCase();
}

// ============================================================================
// HELPER: Sanitize IFSC code
// ============================================================================

export function sanitizeIfsc(ifsc: string): string {
  return ifsc.trim().toUpperCase();
}

// ============================================================================
// HELPER: Sanitize Account Number
// ============================================================================

export function sanitizeAccountNumber(accountNumber: string): string {
  return accountNumber.trim().replace(/\s+/g, '');
}

// ============================================================================
// COMMON BANK CODES FOR REFERENCE
// ============================================================================

export const COMMON_BANK_CODES = {
  SBIN: 'State Bank of India',
  HDFC: 'HDFC Bank',
  ICIC: 'ICICI Bank',
  UTIB: 'Axis Bank',
  KKBK: 'Kotak Mahindra Bank',
  PUNB: 'Punjab National Bank',
  UBIN: 'Union Bank of India',
  CNRB: 'Canara Bank',
  BKID: 'Bank of India',
  BARB: 'Bank of Baroda',
  IDFB: 'IDFC First Bank',
  INDB: 'IndusInd Bank',
} as const;

// ============================================================================
// HELPER: Extract bank code from IFSC
// ============================================================================

export function extractBankCode(ifsc: string): string {
  return ifsc.substring(0, 4);
}

// ============================================================================
// HELPER: Get bank name from IFSC
// ============================================================================

export function getBankNameFromIfsc(ifsc: string): string | null {
  const bankCode = extractBankCode(ifsc);
  return COMMON_BANK_CODES[bankCode as keyof typeof COMMON_BANK_CODES] || null;
}
