import { ChevronLeft, User, Mail, Phone, MapPin, Calendar, Edit } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProfilePageProps {
  onNavigateHome: () => void;
}

export function ProfilePage({ onNavigateHome }: ProfilePageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: '',
    dateOfBirth: '',
  });

  const handleSave = () => {
    if (!user?.id) return;
    
    // Update user in registeredUsers
    const usersData = localStorage.getItem('registeredUsers');
    if (usersData) {
      const users = JSON.parse(usersData);
      const userIndex = users.findIndex((u: any) => u.id === user.id);
      
      if (userIndex !== -1) {
        users[userIndex] = {
          ...users[userIndex],
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        };
        localStorage.setItem('registeredUsers', JSON.stringify(users));
        
        // Update current user in localStorage
        const updatedUser = {
          ...user,
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        console.log('✅ Profile updated successfully');
        alert('Profile updated successfully!');
      }
    }
    
    setIsEditing(false);
  };

  const handlePasswordChange = () => {
    if (!user?.id) return;
    
    // Validate passwords
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      alert('Please fill all password fields');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      alert('New password must be at least 6 characters');
      return;
    }
    
    // Get user from registeredUsers and verify current password
    const usersData = localStorage.getItem('registeredUsers');
    if (usersData) {
      const users = JSON.parse(usersData);
      const userIndex = users.findIndex((u: any) => u.id === user.id);
      
      if (userIndex !== -1) {
        if (users[userIndex].password !== passwordData.currentPassword) {
          alert('Current password is incorrect');
          return;
        }
        
        // Update password
        users[userIndex].password = passwordData.newPassword;
        localStorage.setItem('registeredUsers', JSON.stringify(users));
        
        console.log('✅ Password updated successfully');
        alert('Password changed successfully!');
        setShowPasswordModal(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm hover:underline mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>BACK TO HOME</span>
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl tracking-wider mb-2">MY PROFILE</h1>
              <p className="text-neutral-600">Manage your personal information</p>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 px-6 py-3 border border-black rounded-full text-sm tracking-wider hover:bg-black hover:text-white transition-colors"
            >
              <Edit className="w-4 h-4" />
              {isEditing ? 'CANCEL' : 'EDIT PROFILE'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="space-y-6">
          {/* Profile Picture */}
          <div className="flex items-center gap-6 pb-6 border-b border-neutral-200">
            <div className="w-24 h-24 bg-neutral-200 rounded-full flex items-center justify-center">
              <User className="w-12 h-12 text-neutral-500" />
            </div>
            {isEditing && (
              <button className="text-sm underline hover:no-underline">
                Change Photo
              </button>
            )}
          </div>

          {/* Personal Information */}
          <div>
            <h2 className="text-2xl tracking-wider mb-6">PERSONAL INFORMATION</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm tracking-wider mb-2">FULL NAME</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                  />
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded">
                    <User className="w-5 h-5 text-neutral-600" />
                    <span>{formData.fullName}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm tracking-wider mb-2">EMAIL ADDRESS</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                  />
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded">
                    <Mail className="w-5 h-5 text-neutral-600" />
                    <span>{formData.email}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm tracking-wider mb-2">PHONE NUMBER</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                  />
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded">
                    <Phone className="w-5 h-5 text-neutral-600" />
                    <span>{formData.phone || 'Not provided'}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm tracking-wider mb-2">DATE OF BIRTH</label>
                {isEditing ? (
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                  />
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded">
                    <Calendar className="w-5 h-5 text-neutral-600" />
                    <span>{formData.dateOfBirth || 'Not provided'}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm tracking-wider mb-2">ADDRESS</label>
                {isEditing ? (
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={3}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors resize-none"
                    placeholder="Enter your address"
                  />
                ) : (
                  <div className="flex items-start gap-3 p-4 bg-neutral-50 rounded">
                    <MapPin className="w-5 h-5 text-neutral-600 mt-0.5" />
                    <span>{formData.address || 'Not provided'}</span>
                  </div>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleSave}
                  className="bg-black text-white px-8 py-3 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
                >
                  SAVE CHANGES
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="border border-neutral-300 px-8 py-3 rounded-full text-sm tracking-wider hover:bg-neutral-50 transition-colors"
                >
                  CANCEL
                </button>
              </div>
            )}
          </div>

          {/* Account Security */}
          <div className="pt-6 border-t border-neutral-200">
            <h2 className="text-2xl tracking-wider mb-6">ACCOUNT SECURITY</h2>
            <div className="space-y-3">
              <button 
                onClick={() => setShowPasswordModal(true)}
                className="w-full text-left p-4 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors">
                <p className="tracking-wider mb-1">Change Password</p>
                <p className="text-sm text-neutral-600">Update your password regularly for security</p>
              </button>
              <button className="w-full text-left p-4 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors">
                <p className="tracking-wider mb-1">Two-Factor Authentication</p>
                <p className="text-sm text-neutral-600">Add an extra layer of security to your account</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl tracking-wider mb-6">CHANGE PASSWORD</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm tracking-wider mb-2">CURRENT PASSWORD</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                  placeholder="Enter current password"
                />
              </div>
              
              <div>
                <label className="block text-sm tracking-wider mb-2">NEW PASSWORD</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                  placeholder="Minimum 6 characters"
                />
              </div>
              
              <div>
                <label className="block text-sm tracking-wider mb-2">CONFIRM NEW PASSWORD</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                  placeholder="Re-enter new password"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePasswordChange}
                className="flex-1 bg-black text-white px-6 py-3 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
              >
                UPDATE PASSWORD
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                  });
                }}
                className="px-6 py-3 border border-neutral-300 rounded-full text-sm tracking-wider hover:bg-neutral-50 transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
