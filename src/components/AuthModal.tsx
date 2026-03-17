import { X, Eye, EyeOff, User, Mail, Phone, Lock, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  validateEmail as validateEmailUtil, 
  validatePassword as validatePasswordUtil, 
  validatePhone as validatePhoneUtil,
  validateName,
  sanitizeText,
  rateLimiter 
} from '../utils/validation';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { login, signup, forgotPassword } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Form states
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  const [signupData, setSignupData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [rateLimitError, setRateLimitError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<{
    strength: string;
    feedback: string[];
  } | null>(null);

  // Validation functions - replaced with comprehensive utilities
  const validateEmail = (email: string): boolean => {
    return validateEmailUtil(email).valid;
  };

  const validatePassword = (password: string): boolean => {
    const result = validatePasswordUtil(password);
    if (!result.valid) {
      setPasswordStrength({ 
        strength: result.strength, 
        feedback: result.feedback 
      });
    }
    return result.valid;
  };

  const validatePhone = (phone: string): boolean => {
    return validatePhoneUtil(phone).valid;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    setGeneralError('');
    setRateLimitError('');

    // Rate limiting for login attempts
    const rateLimitKey = `login:${sanitizeText(loginData.email)}`;
    if (!rateLimiter.isAllowed(rateLimitKey, 5, 300000)) { // 5 attempts per 5 minutes
      const retryAfter = rateLimiter.getRetryAfter(rateLimitKey, 300000);
      setRateLimitError(`Too many login attempts. Please try again in ${Math.ceil(retryAfter)} seconds.`);
      return;
    }

    // Validation
    if (!loginData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(loginData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!loginData.password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    const result = await login(sanitizeText(loginData.email), loginData.password);
    setIsLoading(false);

    if (result.success) {
      rateLimiter.reset(rateLimitKey); // Reset on successful login
      onClose();
    } else {
      setGeneralError(result.error || 'Login failed. Please try again.');
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    setGeneralError('');
    setRateLimitError('');

    // Rate limiting for signup attempts
    const rateLimitKey = `signup:${sanitizeText(signupData.email)}`;
    if (!rateLimiter.isAllowed(rateLimitKey, 3, 600000)) { // 3 attempts per 10 minutes
      const retryAfter = rateLimiter.getRetryAfter(rateLimitKey, 600000);
      setRateLimitError(`Too many signup attempts. Please try again in ${Math.ceil(retryAfter)} seconds.`);
      return;
    }

    // Validation
    if (!signupData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else {
      const nameValidation = validateName(signupData.fullName);
      if (!nameValidation.valid) {
        newErrors.fullName = nameValidation.error || 'Invalid name';
      }
    }

    if (!signupData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(signupData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!signupData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(signupData.phone)) {
      newErrors.phone = 'Phone number must be 10 digits starting with 6-9';
    }

    if (!signupData.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(signupData.password)) {
      newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, number and special character';
    }

    if (!signupData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (signupData.password !== signupData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    const result = await signup(
      sanitizeText(signupData.fullName),
      sanitizeText(signupData.email),
      sanitizeText(signupData.phone),
      signupData.password
    );
    setIsLoading(false);

    if (result.success) {
      rateLimiter.reset(rateLimitKey); // Reset on successful signup
      onClose();
    } else {
      setGeneralError(result.error || 'Signup failed. Please try again.');
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    setGeneralError('');

    if (!resetEmail) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(resetEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    const result = await forgotPassword(resetEmail);
    setIsLoading(false);

    if (result.success) {
      setResetSuccess(true);
      setTimeout(() => {
        setIsForgotPassword(false);
        setIsLogin(true);
        setResetSuccess(false);
        setResetEmail('');
      }, 3000);
    } else {
      setGeneralError(result.error || 'Failed to send reset email. Please try again.');
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setIsForgotPassword(false);
    setResetSuccess(false);
    setErrors({});
    setGeneralError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slideUp">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-neutral-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl tracking-wider mb-2">
              {isLogin ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
            </h1>
            <p className="text-neutral-600 text-sm">
              {isLogin 
                ? 'Sign in to continue shopping' 
                : 'Join us to start your fashion journey'}
            </p>
          </div>

          {/* General Error */}
          {generalError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{generalError}</p>
            </div>
          )}

          {/* Rate Limit Error */}
          {rateLimitError && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-orange-600 text-sm">{rateLimitError}</p>
            </div>
          )}

          {/* Forgot Password Form */}
          {isForgotPassword ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              {resetSuccess ? (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-600 text-sm">
                    ✅ Password reset link sent! Check your email.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm tracking-wider mb-2">
                      EMAIL ADDRESS
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => {
                          setResetEmail(e.target.value);
                          setErrors({ ...errors, email: '' });
                          setGeneralError('');
                        }}
                        className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black transition-colors"
                        placeholder="your.email@example.com"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-600 text-xs mt-1">{errors.email}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3 rounded-full text-sm tracking-wider transition-colors ${
                      isLoading
                        ? 'bg-neutral-400 text-neutral-600 cursor-not-allowed'
                        : 'bg-black text-white hover:bg-neutral-800'
                    }`}
                  >
                    {isLoading ? 'SENDING...' : 'SEND RESET LINK'}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setIsLogin(true);
                        setErrors({});
                        setGeneralError('');
                      }}
                      className="text-sm text-black hover:underline"
                    >
                      ← Back to Login
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : isLogin ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm tracking-wider mb-2">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type="email"
                    value={loginData.email}
                    onChange={(e) => {
                      setLoginData({ ...loginData, email: e.target.value });
                      setErrors({ ...errors, email: '' });
                      setGeneralError('');
                    }}
                    className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="your.email@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-600 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm tracking-wider mb-2">
                  PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginData.password}
                    onChange={(e) => {
                      setLoginData({ ...loginData, password: e.target.value });
                      setErrors({ ...errors, password: '' });
                      setGeneralError('');
                    }}
                    className="w-full pl-11 pr-11 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-black"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-600 text-xs mt-1">{errors.password}</p>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 text-black focus:ring-black"
                  />
                  <span className="text-sm text-neutral-600">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setIsLogin(false);
                    setErrors({});
                    setGeneralError('');
                  }}
                  className="text-sm text-black hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 rounded-full text-sm tracking-wider transition-colors ${
                  isLoading
                    ? 'bg-neutral-400 text-neutral-600 cursor-not-allowed'
                    : 'bg-black text-white hover:bg-neutral-800'
                }`}
              >
                {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
              </button>
            </form>
          ) : (
            /* Signup Form */
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm tracking-wider mb-2">
                  FULL NAME
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type="text"
                    value={signupData.fullName}
                    onChange={(e) => {
                      setSignupData({ ...signupData, fullName: e.target.value });
                      setErrors({ ...errors, fullName: '' });
                    }}
                    className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="Enter your full name"
                  />
                </div>
                {errors.fullName && (
                  <p className="text-red-600 text-xs mt-1">{errors.fullName}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm tracking-wider mb-2">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type="email"
                    value={signupData.email}
                    onChange={(e) => {
                      setSignupData({ ...signupData, email: e.target.value });
                      setErrors({ ...errors, email: '' });
                      setGeneralError('');
                    }}
                    className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="your.email@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-600 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm tracking-wider mb-2">
                  PHONE NUMBER
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type="tel"
                    value={signupData.phone}
                    onChange={(e) => {
                      setSignupData({ ...signupData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) });
                      setErrors({ ...errors, phone: '' });
                    }}
                    className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                  />
                </div>
                {errors.phone && (
                  <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm tracking-wider mb-2">
                  PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={signupData.password}
                    onChange={(e) => {
                      const pwd = e.target.value;
                      setSignupData({ ...signupData, password: pwd });
                      setErrors({ ...errors, password: '' });
                      // Update password strength in real-time
                      if (pwd) {
                        const result = validatePasswordUtil(pwd);
                        setPasswordStrength({ 
                          strength: result.strength, 
                          feedback: result.feedback 
                        });
                      } else {
                        setPasswordStrength(null);
                      }
                    }}
                    className="w-full pl-11 pr-11 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-black"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-600 text-xs mt-1">{errors.password}</p>
                )}
                {/* Password Strength Indicator */}
                {passwordStrength && signupData.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded transition-colors ${
                            passwordStrength.strength === 'weak' && level === 1
                              ? 'bg-red-500'
                              : passwordStrength.strength === 'medium' && level <= 2
                              ? 'bg-orange-500'
                              : passwordStrength.strength === 'strong' && level <= 3
                              ? 'bg-yellow-500'
                              : passwordStrength.strength === 'very-strong' && level <= 4
                              ? 'bg-green-500'
                              : 'bg-neutral-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${
                      passwordStrength.strength === 'weak' ? 'text-red-600' :
                      passwordStrength.strength === 'medium' ? 'text-orange-600' :
                      passwordStrength.strength === 'strong' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      Password Strength: {passwordStrength.strength.charAt(0).toUpperCase() + passwordStrength.strength.slice(1).replace('-', ' ')}
                    </p>
                    {passwordStrength.feedback.length > 0 && (
                      <ul className="text-xs text-neutral-600 mt-1 space-y-0.5">
                        {passwordStrength.feedback.map((tip, idx) => (
                          <li key={idx}>• {tip}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm tracking-wider mb-2">
                  CONFIRM PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={signupData.confirmPassword}
                    onChange={(e) => {
                      setSignupData({ ...signupData, confirmPassword: e.target.value });
                      setErrors({ ...errors, confirmPassword: '' });
                    }}
                    className="w-full pl-11 pr-11 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-black"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-600 text-xs mt-1">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 text-black focus:ring-black"
                  />
                  <span className="text-sm text-neutral-600">Remember me</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 rounded-full text-sm tracking-wider transition-colors ${
                  isLoading
                    ? 'bg-neutral-400 text-neutral-600 cursor-not-allowed'
                    : 'bg-black text-white hover:bg-neutral-800'
                }`}
              >
                {isLoading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </button>
            </form>
          )}

          {/* Toggle Login/Signup */}
          {!isForgotPassword && (
            <div className="mt-6 text-center">
              <p className="text-sm text-neutral-600">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={switchMode}
                  className="text-black hover:underline"
                >
                  {isLogin ? 'Sign Up' : 'Login'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
