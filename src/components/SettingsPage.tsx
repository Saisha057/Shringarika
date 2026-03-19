import { ChevronLeft, Bell, Lock, CreditCard, Trash2, Eye, EyeOff, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import API from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface SettingsPageProps {
  onNavigateHome: () => void;
}

interface PaymentMethod {
  id: number;
  payment_type: string;
  last_four: string;
  card_brand?: string;
  expiry_month?: number;
  expiry_year?: number;
  is_default: boolean;
}

export function SettingsPage({ onNavigateHome }: SettingsPageProps) {
  const { isAuthenticated, user, logout } = useAuth();
  
  // Notification settings
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      orderUpdates: true,
    },
  });

  // Change Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Delete Account Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Payment Methods
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
      loadPaymentMethods();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadSettings = async () => {
    try {
      // Try to load from backend first
      const response = await API.get('/users/settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      if (response.data.data?.settings) {
        setSettings(response.data.data.settings);
        // Save to localStorage as well
        localStorage.setItem('userSettings', JSON.stringify(response.data.data.settings));
      }
    } catch (error) {
      console.log('Backend not available, loading from localStorage');
      // Fallback to localStorage
      const savedSettings = localStorage.getItem('userSettings');
      if (savedSettings) {
        try {
          setSettings(JSON.parse(savedSettings));
        } catch (e) {
          console.error('Failed to parse saved settings');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await API.get('/users/payment-methods', {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      if (response.data.data?.paymentMethods) {
        setPaymentMethods(response.data.data.paymentMethods);
      }
    } catch (error) {
      console.log('Payment methods not available from backend');
    }
  };

  const saveSettings = async (newSettings: typeof settings) => {
    if (!isAuthenticated) {
      alert('Please login to save settings');
      return;
    }

    setSaving(true);
    
    // Always save to localStorage first
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
    
    try {
      // Try to save to backend
      await API.put('/users/settings', newSettings, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      console.log('✅ Settings saved to backend');
    } catch (error: any) {
      console.log('⚠️ Backend not available, settings saved locally only');
      // Settings are already saved to localStorage, so this is not a failure
    } finally {
      setSaving(false);
    }
  };

  const toggleNotificationSetting = async (category: 'notifications', key: string) => {
    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: !settings[category][key as keyof typeof settings.notifications]
      }
    };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('One number');
    if (!/[!@#$%^&*]/.test(password)) errors.push('One special character (!@#$%^&*)');
    return errors;
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    // Validation
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    const passwordErrors = validatePassword(passwordForm.newPassword);
    if (passwordErrors.length > 0) {
      setPasswordError(`Password must have: ${passwordErrors.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      const response = await API.put(
        '/users/change-password',
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
        }
      );

      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
      // Close modal and logout after 2 seconds
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
        alert('Password changed successfully. Please login again.');
        logout();
        onNavigateHome();
      }, 2000);
    } catch (error: any) {
      console.error('Password change error:', error);
      setPasswordError(error.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');

    if (!deletePassword) {
      setDeleteError('Password is required');
      return;
    }

    const confirmed = window.confirm(
      'Are you absolutely sure? This action CANNOT be undone. All your data will be permanently deleted.'
    );

    if (!confirmed) return;

    setSaving(true);
    try {
      await API.delete('/users/account', {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        data: { password: deletePassword }
      });

      alert('Account deleted successfully. Goodbye!');
      logout();
      onNavigateHome();
    } catch (error: any) {
      console.error('Delete account error:', error);
      setDeleteError(error.response?.data?.message || 'Failed to delete account. Backend may not be available.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePaymentMethod = async (id: number) => {
    if (!window.confirm('Delete this payment method?')) return;

    try {
      await API.delete(`/users/payment-methods/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      await loadPaymentMethods();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete payment method');
    }
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <p className="text-neutral-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 min-h-screen transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <button 
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-sm hover:underline mb-4 dark:text-neutral-300"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>BACK TO HOME</span>
          </button>
          
          <h1 className="text-5xl tracking-wider mb-2 dark:text-white">SETTINGS</h1>
          <p className="text-neutral-600 dark:text-neutral-400">Manage your account preferences</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="space-y-8">
          {/* Notifications */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-6 h-6 dark:text-neutral-300" />
              <h2 className="text-2xl tracking-wider dark:text-white">NOTIFICATIONS</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 border border-neutral-300 dark:border-neutral-700 rounded-lg dark:bg-neutral-800">
                <div>
                  <p className="tracking-wider mb-1 dark:text-white">Email Notifications</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Receive updates via email
                  </p>
                </div>
                <button
                  onClick={() => toggleNotificationSetting('notifications', 'email')}
                  disabled={saving}
                  className={`w-14 h-8 rounded-full transition-colors relative ${
                    settings.notifications.email ? 'bg-black dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 ${
                      settings.notifications.email ? 'bg-white dark:bg-black' : 'bg-white'
                    } rounded-full transition-transform ${
                      settings.notifications.email ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              
              <div className="flex items-center justify-between p-4 border border-neutral-300 dark:border-neutral-700 rounded-lg dark:bg-neutral-800">
                <div>
                  <p className="tracking-wider mb-1 dark:text-white">Order Updates</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Get notified about your orders
                  </p>
                </div>
                <button
                  onClick={() => toggleNotificationSetting('notifications', 'orderUpdates')}
                  disabled={saving}
                  className={`w-14 h-8 rounded-full transition-colors relative ${
                    settings.notifications.orderUpdates ? 'bg-black dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 ${
                      settings.notifications.orderUpdates ? 'bg-white dark:bg-black' : 'bg-white'
                    } rounded-full transition-transform ${
                      settings.notifications.orderUpdates ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Security & Privacy */}
          <section className="pt-8 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 dark:text-neutral-300" />
              <h2 className="text-2xl tracking-wider dark:text-white">SECURITY & PRIVACY</h2>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => setShowPasswordModal(true)}
                className="w-full text-left p-4 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors dark:bg-neutral-800"
              >
                <p className="tracking-wider mb-1 dark:text-white">Change Password</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Update your password for security</p>
              </button>
            </div>
          </section>

          {/* Payment Methods */}
          <section className="pt-8 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-6 h-6 dark:text-neutral-300" />
              <h2 className="text-2xl tracking-wider dark:text-white">PAYMENT METHODS</h2>
            </div>
            
            <button 
              onClick={() => setShowPaymentModal(true)}
              className="w-full text-left p-4 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors dark:bg-neutral-800"
            >
              <p className="tracking-wider mb-1 dark:text-white">Saved Payment Methods</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {paymentMethods.length > 0 
                  ? `${paymentMethods.length} saved method${paymentMethods.length !== 1 ? 's' : ''}`
                  : 'Manage your saved cards and UPI IDs'}
              </p>
            </button>
          </section>

          {/* Danger Zone */}
          <section className="pt-8 border-t border-red-200 dark:border-red-900">
            <h2 className="text-2xl tracking-wider text-red-600 dark:text-red-400 mb-4">DANGER ZONE</h2>
            
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="w-full text-left p-4 border border-red-300 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors dark:bg-neutral-800"
            >
              <p className="tracking-wider mb-1 text-red-600 dark:text-red-400">Delete Account</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Permanently delete your account and all data</p>
            </button>
          </section>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl tracking-wider dark:text-white">CHANGE PASSWORD</h3>
              <button onClick={() => setShowPasswordModal(false)} className="p-2">
                <X className="w-5 h-5 dark:text-neutral-300" />
              </button>
            </div>

            {passwordSuccess && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-800 dark:text-green-300">Password changed successfully!</span>
              </div>
            )}

            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-800 dark:text-red-300">{passwordError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm tracking-wider mb-2 dark:text-neutral-300">CURRENT PASSWORD</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                    className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-4 py-3 pr-12 text-sm focus:outline-none focus:border-black dark:focus:border-white dark:bg-neutral-700 dark:text-white"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
                  >
                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm tracking-wider mb-2 dark:text-neutral-300">NEW PASSWORD</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-4 py-3 pr-12 text-sm focus:outline-none focus:border-black dark:focus:border-white dark:bg-neutral-700 dark:text-white"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Must be 8+ characters with uppercase, lowercase, number & special character
                </p>
              </div>

              <div>
                <label className="block text-sm tracking-wider mb-2 dark:text-neutral-300">CONFIRM NEW PASSWORD</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-4 py-3 pr-12 text-sm focus:outline-none focus:border-black dark:focus:border-white dark:bg-neutral-700 dark:text-white"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 border border-neutral-300 dark:border-neutral-600 rounded px-6 py-3 text-sm tracking-wider hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors dark:text-white"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={saving}
                  className="flex-1 bg-black dark:bg-white text-white dark:text-black rounded px-6 py-3 text-sm tracking-wider hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:bg-neutral-400"
                >
                  {saving ? 'CHANGING...' : 'CHANGE PASSWORD'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Methods Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl tracking-wider dark:text-white">SAVED PAYMENT METHODS</h3>
              <button onClick={() => setShowPaymentModal(false)} className="p-2">
                <X className="w-5 h-5 dark:text-neutral-300" />
              </button>
            </div>

            {paymentMethods.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
                <p className="text-neutral-600 dark:text-neutral-400 mb-2">No saved payment methods</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-500">
                  Add a payment method during checkout to save it for future purchases
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center justify-between p-4 border border-neutral-300 dark:border-neutral-600 rounded dark:bg-neutral-700">
                    <div className="flex items-center gap-4">
                      <CreditCard className="w-8 h-8 text-neutral-600 dark:text-neutral-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="tracking-wider dark:text-white">
                            {method.card_brand ? method.card_brand.toUpperCase() : method.payment_type.toUpperCase()} 
                            {method.last_four && ` •••• ${method.last_four}`}
                          </p>
                          {method.is_default && (
                            <span className="text-xs bg-black dark:bg-white text-white dark:text-black px-2 py-1 rounded">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        {method.expiry_month && method.expiry_year && (
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            Expires {method.expiry_month}/{method.expiry_year}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePaymentMethod(method.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Note:</strong> To add new payment methods, save them during checkout. 
                All payment data is securely tokenized and PCI-compliant.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl tracking-wider text-red-600 dark:text-red-400">DELETE ACCOUNT</h3>
              <button onClick={() => setShowDeleteModal(false)} className="p-2">
                <X className="w-5 h-5 dark:text-neutral-300" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="text-sm text-red-800 dark:text-red-300 mb-2">
                <strong>Warning:</strong> This action cannot be undone.
              </p>
              <ul className="text-sm text-red-700 dark:text-red-400 list-disc list-inside space-y-1">
                <li>All your personal data will be permanently deleted</li>
                <li>Your order history will be removed</li>
                <li>Saved addresses and payment methods will be deleted</li>
                <li>You will be logged out immediately</li>
              </ul>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-800 dark:text-red-300">{deleteError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm tracking-wider mb-2 dark:text-neutral-300">
                  CONFIRM YOUR PASSWORD
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-4 py-3 text-sm focus:outline-none focus:border-red-600 dark:bg-neutral-700 dark:text-white"
                  placeholder="Enter your password"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 border border-neutral-300 dark:border-neutral-600 rounded px-6 py-3 text-sm tracking-wider hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors dark:text-white"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  className="flex-1 bg-red-600 text-white rounded px-6 py-3 text-sm tracking-wider hover:bg-red-700 transition-colors disabled:bg-neutral-400"
                >
                  {saving ? 'DELETING...' : 'DELETE ACCOUNT'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
