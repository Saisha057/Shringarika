'use client';

// ============================================================================
// Payment Verification Component (Next.js App Router)
// ============================================================================
// Purpose: Frontend UI for verifying UPI IDs and Bank Accounts
// Features: Real-time validation, loading states, error handling
// ============================================================================

import { useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type PaymentMethodType = 'UPI' | 'BANK' | null;

interface VerificationResult {
  success: boolean;
  verified: boolean;
  message: string;
  warning?: string;
  // UPI specific
  upi_id?: string;
  registered_name?: string;
  // Bank specific
  account_number?: string;
  ifsc?: string;
  account_holder_name?: string;
  bank_name?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PaymentVerificationComponent() {
  // State management
  const [selectedType, setSelectedType] = useState<PaymentMethodType>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);

  // UPI form state
  const [upiId, setUpiId] = useState('');

  // Bank form state
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  // ============================================================================
  // HANDLER: Verify UPI ID
  // ============================================================================

  const handleVerifyUpi = async () => {
    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const response = await fetch('/api/verify-upi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ upi_id: upiId }),
      });

      const data = await response.json();

      if (response.status === 429) {
        setVerificationResult({
          success: false,
          verified: false,
          message: data.message || 'Rate limit exceeded. Please try again later.',
        });
      } else {
        setVerificationResult(data);
      }
    } catch (error) {
      setVerificationResult({
        success: false,
        verified: false,
        message: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // ============================================================================
  // HANDLER: Verify Bank Account
  // ============================================================================

  const handleVerifyBank = async () => {
    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const response = await fetch('/api/verify-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          account_number: accountNumber,
          ifsc: ifscCode,
        }),
      });

      const data = await response.json();

      if (response.status === 429) {
        setVerificationResult({
          success: false,
          verified: false,
          message: data.message || 'Rate limit exceeded. Please try again later.',
        });
      } else {
        setVerificationResult(data);
      }
    } catch (error) {
      setVerificationResult({
        success: false,
        verified: false,
        message: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // ============================================================================
  // HANDLER: Save Verified Payment Method
  // ============================================================================

  const handleSavePaymentMethod = async () => {
    if (!verificationResult?.verified) {
      alert('Please verify the payment method first');
      return;
    }

    try {
      const payload =
        selectedType === 'UPI'
          ? {
              type: 'UPI',
              identifier: verificationResult.upi_id,
              account_holder_name: verificationResult.registered_name,
              is_verified: true,
              is_default: false,
            }
          : {
              type: 'BANK',
              identifier: verificationResult.account_number,
              ifsc: verificationResult.ifsc,
              account_holder_name: verificationResult.account_holder_name,
              is_verified: true,
              is_default: false,
            };

      const response = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Payment method saved successfully!');
        // Reset form
        setSelectedType(null);
        setUpiId('');
        setAccountNumber('');
        setIfscCode('');
        setVerificationResult(null);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert('❌ Failed to save payment method. Please try again.');
    }
  };

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  const isUpiValid = /^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(upiId);
  const isAccountNumberValid = /^[0-9]{9,18}$/.test(accountNumber);
  const isIfscValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode);

  const canVerifyUpi = upiId.length >= 3 && isUpiValid;
  const canVerifyBank =
    accountNumber.length >= 9 && isAccountNumberValid && isIfscValid;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Add Payment Method
        </h1>
        <p className="text-gray-600">
          Verify your UPI ID or Bank Account for secure refunds
        </p>
      </div>

      {/* Payment Type Selection */}
      {!selectedType && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSelectedType('UPI')}
            className="p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
          >
            <div className="text-4xl mb-3">📱</div>
            <h3 className="text-xl font-semibold mb-2">UPI ID</h3>
            <p className="text-gray-600 text-sm">
              Verify your UPI ID (e.g., username@paytm)
            </p>
          </button>

          <button
            onClick={() => setSelectedType('BANK')}
            className="p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
          >
            <div className="text-4xl mb-3">🏦</div>
            <h3 className="text-xl font-semibold mb-2">Bank Account</h3>
            <p className="text-gray-600 text-sm">
              Verify your bank account with IFSC code
            </p>
          </button>
        </div>
      )}

      {/* UPI Verification Form */}
      {selectedType === 'UPI' && (
        <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">UPI ID Verification</h2>
            <button
              onClick={() => {
                setSelectedType(null);
                setUpiId('');
                setVerificationResult(null);
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Change
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              UPI ID
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value.toLowerCase())}
              placeholder="username@paytm"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isVerifying}
            />
            {upiId && !isUpiValid && (
              <p className="text-sm text-red-600 mt-1">
                ⚠️ Invalid format. Example: username@paytm
              </p>
            )}
          </div>

          <button
            onClick={handleVerifyUpi}
            disabled={!canVerifyUpi || isVerifying}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Verifying...
              </>
            ) : (
              'Verify UPI ID'
            )}
          </button>
        </div>
      )}

      {/* Bank Verification Form */}
      {selectedType === 'BANK' && (
        <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Bank Account Verification</h2>
            <button
              onClick={() => {
                setSelectedType(null);
                setAccountNumber('');
                setIfscCode('');
                setVerificationResult(null);
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Change
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Number
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) =>
                setAccountNumber(e.target.value.replace(/\D/g, ''))
              }
              placeholder="1234567890"
              maxLength={18}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isVerifying}
            />
            {accountNumber && !isAccountNumberValid && (
              <p className="text-sm text-red-600 mt-1">
                ⚠️ Must be 9-18 digits
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IFSC Code
            </label>
            <input
              type="text"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
              placeholder="SBIN0001234"
              maxLength={11}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              disabled={isVerifying}
            />
            {ifscCode && !isIfscValid && (
              <p className="text-sm text-red-600 mt-1">
                ⚠️ Invalid format. Example: SBIN0001234
              </p>
            )}
          </div>

          <button
            onClick={handleVerifyBank}
            disabled={!canVerifyBank || isVerifying}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Verifying...
              </>
            ) : (
              'Verify Bank Account'
            )}
          </button>
        </div>
      )}

      {/* Verification Result */}
      {verificationResult && (
        <div
          className={`border-2 rounded-lg p-6 mb-6 ${
            verificationResult.verified
              ? 'border-green-500 bg-green-50'
              : 'border-red-500 bg-red-50'
          }`}
        >
          <div className="flex items-start gap-3">
            {verificationResult.verified ? (
              <CheckCircle2 className="text-green-600 flex-shrink-0" size={24} />
            ) : (
              <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
            )}
            <div className="flex-1">
              <h3
                className={`font-semibold mb-2 ${
                  verificationResult.verified ? 'text-green-900' : 'text-red-900'
                }`}
              >
                {verificationResult.verified ? '✅ Verified' : '❌ Not Verified'}
              </h3>
              <p
                className={`text-sm mb-3 ${
                  verificationResult.verified ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {verificationResult.message}
              </p>

              {verificationResult.verified && (
                <div className="bg-white border border-green-300 rounded p-4 mb-4">
                  <p className="text-sm text-gray-700 font-medium mb-2">
                    Account Holder Name:
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {verificationResult.registered_name ||
                      verificationResult.account_holder_name}
                  </p>
                  {verificationResult.bank_name && (
                    <p className="text-sm text-gray-600 mt-1">
                      Bank: {verificationResult.bank_name}
                    </p>
                  )}
                </div>
              )}

              {verificationResult.warning && (
                <div className="flex items-start gap-2 bg-yellow-100 border border-yellow-400 rounded p-3 mb-4">
                  <Info className="text-yellow-700 flex-shrink-0" size={18} />
                  <p className="text-sm text-yellow-900">
                    {verificationResult.warning}
                  </p>
                </div>
              )}

              {verificationResult.verified && (
                <button
                  onClick={handleSavePaymentMethod}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  Confirm & Save Payment Method
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="text-blue-600 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Why verify?</p>
            <p>
              We verify payment methods to ensure refunds are sent to the correct
              account. This protects both you and us from fraud.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
