import { useState, useEffect } from 'react';
import { Check, X, Loader2, AlertCircle } from 'lucide-react';
import api from '../services/api';

interface UPIVerificationProps {
  onVerified: (upiId: string, verifiedName: string) => void;
  context: 'payment' | 'refund';
  orderId?: string;
  initialValue?: string;
  required?: boolean;
}

export function UPIVerification({ 
  onVerified, 
  context, 
  orderId, 
  initialValue = '', 
  required = true 
}: UPIVerificationProps) {
  const [upiId, setUpiId] = useState(initialValue);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifiedName, setVerifiedName] = useState('');
  const [error, setError] = useState('');
  const [formatValid, setFormatValid] = useState(false);

  // Format validation (client-side)
  useEffect(() => {
    if (!upiId) {
      setFormatValid(false);
      setError('');
      return;
    }

    const trimmed = upiId.trim().toLowerCase();
    
    // Basic format check
    if (!trimmed.includes('@')) {
      setFormatValid(false);
      setError('UPI ID must contain @ symbol');
      return;
    }

    if (trimmed.split('@').length !== 2) {
      setFormatValid(false);
      setError('UPI ID must contain exactly one @ symbol');
      return;
    }

    const [username, handle] = trimmed.split('@');

    if (username.length < 2) {
      setFormatValid(false);
      setError('Username must be at least 2 characters');
      return;
    }

    if (handle.length < 3) {
      setFormatValid(false);
      setError('Handle must be at least 3 characters');
      return;
    }

    // Check for spaces
    if (trimmed.includes(' ')) {
      setFormatValid(false);
      setError('UPI ID cannot contain spaces');
      return;
    }

    // Character validation
    const usernameRegex = /^[a-z0-9._-]+$/;
    const handleRegex = /^[a-z0-9.-]+$/;

    if (!usernameRegex.test(username)) {
      setFormatValid(false);
      setError('Username can only contain lowercase letters, numbers, dots, underscores, and hyphens');
      return;
    }

    if (!handleRegex.test(handle)) {
      setFormatValid(false);
      setError('Handle can only contain lowercase letters, numbers, dots, and hyphens');
      return;
    }

    // Format is valid
    setFormatValid(true);
    setError('');
  }, [upiId]);

  const handleVerify = async () => {
    if (!formatValid || !upiId) {
      setError('Please enter a valid UPI ID');
      return;
    }

    setVerifying(true);
    setError('');
    setVerified(false);

    try {
      const response = await api.post('/upi/verify', {
        upiId: upiId.trim().toLowerCase(),
        context,
        orderId
      });

      if (response.data.success && response.data.valid) {
        setVerified(true);
        setVerifiedName(response.data.verifiedName || '');
        setError('');
        onVerified(response.data.upiId, response.data.verifiedName || '');
      } else {
        setVerified(false);
        setError(response.data.errorReason === 'INVALID_UPI_ID' 
          ? 'This UPI ID is not valid or not active' 
          : 'Failed to verify UPI ID. Please check and try again.');
      }
    } catch (err: any) {
      console.error('UPI verification error:', err);
      
      if (err.response?.status === 429) {
        setError('Too many verification attempts. Please try again later.');
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to verify UPI ID. Please try again.');
      }
      setVerified(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().trim();
    setUpiId(value);
    setVerified(false);
    setVerifiedName('');
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">
          UPI ID {required && <span className="text-red-500">*</span>}
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={upiId}
              onChange={handleInputChange}
              placeholder="yourname@bankname"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                verified 
                  ? 'border-green-500 focus:ring-green-200 bg-green-50' 
                  : error 
                  ? 'border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 focus:ring-black'
              }`}
              disabled={verified || verifying}
            />
            {verified && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Check className="w-5 h-5 text-green-600" />
              </div>
            )}
          </div>
          <button
            onClick={handleVerify}
            disabled={!formatValid || verifying || verified}
            className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              verified
                ? 'bg-green-600 text-white cursor-default'
                : !formatValid || verifying
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-black text-white hover:bg-neutral-800'
            }`}
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : verified ? (
              <>
                <Check className="w-4 h-4" />
                Verified
              </>
            ) : (
              'Verify UPI'
            )}
          </button>
        </div>
      </div>

      {/* Verification Status */}
      {verified && verifiedName && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <Check className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-900">UPI ID Verified</p>
            <p className="text-xs text-green-700">Account Holder: {verifiedName}</p>
          </div>
        </div>
      )}

      {/* Format Validation Error */}
      {error && !verifying && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Verification Failed</p>
            <p className="text-xs text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Format Guidelines */}
      {!verified && !error && upiId.length > 0 && (
        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-medium">UPI ID Format:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li className={formatValid ? 'text-green-600' : ''}>Must contain exactly one @ symbol</li>
            <li className={formatValid ? 'text-green-600' : ''}>Username minimum 2 characters</li>
            <li className={formatValid ? 'text-green-600' : ''}>No spaces allowed</li>
          </ul>
        </div>
      )}

      {/* Info Message */}
      {!upiId && (
        <div className="text-xs text-gray-500">
          <p>Example: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">saishadubey0112@okhdfcbank</span></p>
        </div>
      )}
    </div>
  );
}
