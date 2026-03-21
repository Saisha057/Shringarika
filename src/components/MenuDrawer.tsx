import { X, ShoppingBag, Info, User, Package, UserCircle, Phone, Heart, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToProducts: () => void;
  onNavigateToAbout: () => void;
  onNavigateToAccount: () => void;
  onNavigateToOrders: () => void;
  onNavigateToProfile: () => void;
  onNavigateToContact: () => void;
  onNavigateToWishlist: () => void;
  onNavigateToSettings: () => void;
  onShowAuthModal: () => void;
}

export function MenuDrawer({
  isOpen,
  onClose,
  onNavigateToProducts,
  onNavigateToAbout,
  onNavigateToAccount,
  onNavigateToOrders,
  onNavigateToProfile,
  onNavigateToContact,
  onNavigateToWishlist,
  onNavigateToSettings,
  onShowAuthModal,
}: MenuDrawerProps) {
  const { user, isAuthenticated, logout } = useAuth();

  // Prevent background scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Connect mobile drawer state to browser back button.
  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ menuDrawerOpen: true }, '', window.location.href);

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  const handleProtectedNavigation = (navigationFn: () => void) => {
    if (!isAuthenticated) {
      onClose();
      onShowAuthModal();
      return;
    }
    onClose();
    navigationFn();
  };

  const handleLogout = () => {
    logout();
    onClose();
    window.location.reload();
  };

  const handleNavigation = (navigationFn: () => void) => {
    onClose();
    navigationFn();
  };

  // Don't render anything if not open
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop Overlay with Blur */}
      <div
        className="fixed inset-0 z-40 animate-fadeIn backdrop-blur-md"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease-in-out'
        }}
        onClick={onClose}
        aria-label="Close menu"
      />

      {/* Drawer */}
      <div
        className="fixed top-0 left-0 h-full bg-white z-50 shadow-2xl w-full sm:w-80 sm:max-w-[85vw] animate-slideIn"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-6 border-b border-neutral-200">
            <h2 className="text-lg sm:text-xl tracking-widest font-medium">MENU</h2>
            <button
              onClick={onClose}
              className="p-3 hover:bg-neutral-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Info / Login Button */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 border-b border-neutral-200">
            {isAuthenticated && user ? (
              <div>
                <p className="text-lg tracking-wider mb-1">{user.name}</p>
                <p className="text-sm text-neutral-600">{user.email}</p>
              </div>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onShowAuthModal();
                }}
                className="w-full bg-black text-white py-3 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors min-h-11"
              >
                SIGN IN / CREATE ACCOUNT
              </button>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-3 sm:py-4">
            <div className="space-y-1 px-3 sm:px-4">
              {/* Shop All */}
              <button
                onClick={() => handleNavigation(onNavigateToProducts)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-neutral-100 rounded-lg transition-colors text-left min-h-12"
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="tracking-wider">Shop All</span>
              </button>

              {/* About Us */}
              <button
                onClick={() => handleNavigation(onNavigateToAbout)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-neutral-100 rounded-lg transition-colors text-left min-h-12"
              >
                <Info className="w-5 h-5" />
                <span className="tracking-wider">About Us</span>
              </button>

              {/* Account */}
              <button
                onClick={() => handleProtectedNavigation(onNavigateToAccount)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-neutral-100 rounded-lg transition-colors text-left min-h-12"
              >
                <User className="w-5 h-5" />
                <span className="tracking-wider">Account</span>
              </button>

              {/* Orders */}
              <button
                onClick={() => handleProtectedNavigation(onNavigateToOrders)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-neutral-100 rounded-lg transition-colors text-left min-h-12"
              >
                <Package className="w-5 h-5" />
                <span className="tracking-wider">Orders</span>
              </button>

              {/* Profile */}
              <button
                onClick={() => handleProtectedNavigation(onNavigateToProfile)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-neutral-100 rounded-lg transition-colors text-left min-h-12"
              >
                <UserCircle className="w-5 h-5" />
                <span className="tracking-wider">Profile</span>
              </button>

              {/* Contact Us */}
              <button
                onClick={() => handleNavigation(onNavigateToContact)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-neutral-100 rounded-lg transition-colors text-left min-h-12"
              >
                <Phone className="w-5 h-5" />
                <span className="tracking-wider">Contact Us</span>
              </button>

              {/* Wishlist */}
              <button
                onClick={() => handleProtectedNavigation(onNavigateToWishlist)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-neutral-100 rounded-lg transition-colors text-left min-h-12"
              >
                <Heart className="w-5 h-5" />
                <span className="tracking-wider">Wishlist</span>
              </button>

              {/* Settings */}
              <button
                onClick={() => handleProtectedNavigation(onNavigateToSettings)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-neutral-100 rounded-lg transition-colors text-left min-h-12"
              >
                <Settings className="w-5 h-5" />
                <span className="tracking-wider">Settings</span>
              </button>

              {/* Logout (only when authenticated) */}
              {isAuthenticated && (
                <>
                  <div className="my-4 border-t border-neutral-200" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-red-50 rounded-lg transition-colors text-left text-red-600 min-h-12"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="tracking-wider">Logout</span>
                  </button>
                </>
              )}
            </div>
          </nav>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 border-t border-neutral-200">
            <p className="text-xs text-neutral-500 text-center">
              © {new Date().getFullYear()} Shringarika. All rights reserved.
            </p>
          </div>
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

        @keyframes slideIn {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-in-out;
        }
      `}</style>
    </>
  );
}
