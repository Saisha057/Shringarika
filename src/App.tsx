"use client"

import { useState, useEffect, lazy, Suspense } from "react"
import { Header } from "./components/Header"
import { HeroSection } from "./components/HeroSection"
import { ProductDetailsSection } from "./components/ProductDetailsSection"
import { InfoSections } from "./components/InfoSections"
import { RecommendedProducts } from "./components/RecommendedProducts"
import { Footer } from "./components/Footer"
import { AuthModal } from "./components/AuthModal"
import { CartProvider } from "./context/CartContext"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { AdminProvider, useAdmin } from "./context/AdminContext"
import { initPerformanceMonitoring } from "./utils/performance"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { initializeSecurity } from "./utils/security"
import { useSwipeBackNavigation } from "./hooks/useSwipeBackNavigation"

// Lazy load heavy components for better performance
const AdminProductsPage = lazy(() => import("./components/AdminProductsPage").then(m => ({ default: m.ProductsPage })))
const ProductDetailPage = lazy(() => import("./components/ProductDetailPage").then(m => ({ default: m.ProductDetailPage })))
const CartPage = lazy(() => import("./components/CartPage").then(m => ({ default: m.CartPage })))
const CheckoutPage = lazy(() => import("./components/CheckoutPage").then(m => ({ default: m.CheckoutPage })))
const OrderConfirmationPage = lazy(() => import("./components/OrderConfirmationPage").then(m => ({ default: m.OrderConfirmationPage })))
const SearchPage = lazy(() => import("./components/SearchPage").then(m => ({ default: m.SearchPage })))
const AboutUsPage = lazy(() => import("./components/AboutUsPage").then(m => ({ default: m.AboutUsPage })))
const ContactUsPage = lazy(() => import("./components/ContactUsPage").then(m => ({ default: m.ContactUsPage })))
const AccountPage = lazy(() => import("./components/AccountPage").then(m => ({ default: m.AccountPage })))
const OrdersPage = lazy(() => import("./components/OrdersPage").then(m => ({ default: m.OrdersPage })))
const ProfilePage = lazy(() => import("./components/ProfilePage").then(m => ({ default: m.ProfilePage })))
const WishlistPage = lazy(() => import("./components/WishlistPage").then(m => ({ default: m.WishlistPage })))
const SettingsPage = lazy(() => import("./components/SettingsPage").then(m => ({ default: m.SettingsPage })))
const ShippingInfoPage = lazy(() => import("./components/ShippingInfoPage").then(m => ({ default: m.ShippingInfoPage })))
const FAQPage = lazy(() => import("./components/FAQPage").then(m => ({ default: m.FAQPage })))
const SustainabilityPage = lazy(() => import("./components/SustainabilityPage").then(m => ({ default: m.SustainabilityPage })))
const AdminDashboard = lazy(() => import("./components/AdminDashboard").then(m => ({ default: m.AdminDashboard })))
const ResetPasswordPage = lazy(() => import("./components/ResetPasswordPage").then(m => ({ default: m.ResetPasswordPage })))
const OrderTrackingPage = lazy(() => import("./components/OrderTrackingPage").then(m => ({ default: m.OrderTrackingPage })))
const RecentlyViewedSection = lazy(() => import("./components/RecentlyViewedSection").then(m => ({ default: m.RecentlyViewedSection })))

// NEW: Account Management Components
const MyAccountDashboard = lazy(() => import("./components/MyAccountDashboard").then(m => ({ default: m.MyAccountDashboard })))
const AddressBookPage = lazy(() => import("./components/AddressBookPage").then(m => ({ default: m.AddressBookPage })))
const WalletPage = lazy(() => import("./components/WalletPage").then(m => ({ default: m.WalletPage })))

// Legal Pages
const PrivacyPolicyPage = lazy(() => import("./components/PrivacyPolicyPage").then(m => ({ default: m.PrivacyPolicyPage })))
const TermsOfServicePage = lazy(() => import("./components/TermsOfServicePage").then(m => ({ default: m.TermsOfServicePage })))
const CookiePolicyPage = lazy(() => import("./components/CookiePolicyPage").then(m => ({ default: m.CookiePolicyPage })))

const VALID_PAGES = new Set<string>([
  "home",
  "products",
  "product-detail",
  "cart",
  "checkout",
  "order-confirmation",
  "search",
  "about",
  "contact",
  "account",
  "my-account-dashboard",
  "orders",
  "profile",
  "address-book",
  "wallet",
  "wishlist",
  "settings",
  "shipping",
  "faq",
  "sustainability",
  "reset-password",
  "track-order",
  "privacy-policy",
  "terms-of-service",
  "cookie-policy",
]);

// Loading component for lazy-loaded routes
const PageLoader = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
      <p className="text-sm tracking-wider">LOADING...</p>
    </div>
  </div>
)

function AppContent() {
  console.log("AppContent rendering...");
  const { isAuthenticated } = useAuth()
  const { isAdminMode, setAdminMode } = useAdmin()
  
  // Initialize two-finger swipe back navigation (works on ALL pages)
  useSwipeBackNavigation();
  
  // Initialize performance monitoring and security on app load
  useEffect(() => {
    initPerformanceMonitoring();
    initializeSecurity();
    console.log('🚀 Performance monitoring initialized');
    console.log('🔒 Security measures initialized');
  }, []);
  
  // PERSISTENCE FIX: Restore current page from localStorage on refresh
  const [currentPage, setCurrentPage] = useState<
    | "home"
    | "products"
    | "product-detail"
    | "cart"
    | "checkout"
    | "order-confirmation"
    | "search"
    | "about"
    | "contact"
    | "account"
    | "my-account-dashboard"
    | "orders"
    | "profile"
    | "address-book"
    | "wallet"
    | "wishlist"
    | "settings"
    | "shipping"
    | "faq"
    | "sustainability"
    | "reset-password"
    | "track-order"
    | "privacy-policy"
    | "terms-of-service"
    | "cookie-policy"
  >(() => {
    // Restore page from localStorage, default to "home"
    const savedPage = localStorage.getItem('currentPage') as typeof currentPage | null;
    return savedPage || "home";
  })

  // PERSISTENCE FIX: Restore selected product and order ID from localStorage
  const [selectedProductId, setSelectedProductId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedProductId');
    return saved ? parseInt(saved, 10) : null;
  })
  const [currentOrderId, setCurrentOrderId] = useState<string>(() => {
    return localStorage.getItem('currentOrderId') || "";
  })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [resetToken, setResetToken] = useState(() => {
    return localStorage.getItem('resetToken') || '';
  })
  
  // PERSISTENCE FIX: Save current page to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('currentPage', currentPage);
    // SCROLL FIX: Reset scroll position to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);
  
  // BROWSER HISTORY FIX: Enable browser back/forward buttons
  useEffect(() => {
    // Push state to history when page changes
    const path = currentPage === "home" ? "/" : `/${currentPage}`;
    if (window.location.pathname !== path) {
      window.history.pushState({ page: currentPage }, '', path);
    }
    
    // Handle browser back/forward buttons
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.page && VALID_PAGES.has(event.state.page)) {
        setCurrentPage(event.state.page as typeof currentPage);
      } else {
        // Parse clean URL path first
        const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
        if (path && VALID_PAGES.has(path)) {
          setCurrentPage(path as typeof currentPage);
        } else {
          setCurrentPage('home');
        }
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentPage]);

  // INITIAL URL SYNC: use clean paths only.
  useEffect(() => {
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
    const initialRoute = path;

    if (initialRoute && VALID_PAGES.has(initialRoute)) {
      setCurrentPage(initialRoute as typeof currentPage);
    } else {
      setCurrentPage('home');
      window.history.replaceState({ page: 'home' }, '', '/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // PERSISTENCE FIX: Save selected product ID to localStorage
  useEffect(() => {
    if (selectedProductId) {
      localStorage.setItem('selectedProductId', selectedProductId.toString());
    } else {
      localStorage.removeItem('selectedProductId');
    }
  }, [selectedProductId]);
  
  // PERSISTENCE FIX: Save current order ID to localStorage
  useEffect(() => {
    if (currentOrderId) {
      localStorage.setItem('currentOrderId', currentOrderId);
    } else {
      localStorage.removeItem('currentOrderId');
    }
  }, [currentOrderId]);
  
  // PERSISTENCE FIX: Save reset token to localStorage
  useEffect(() => {
    if (resetToken) {
      localStorage.setItem('resetToken', resetToken);
    } else {
      localStorage.removeItem('resetToken');
    }
  }, [resetToken]);

  // PERSISTENCE FIX: Validate restored page state on mount
  useEffect(() => {
    console.log('🔄 Restoring page state on mount:', {
      currentPage,
      selectedProductId,
      currentOrderId,
      resetToken: resetToken ? 'present' : 'missing'
    });
    
    // If we're on product-detail but no product is selected, go to home
    if (currentPage === "product-detail" && !selectedProductId) {
      console.log('⚠️ Invalid state: product-detail without selectedProductId, redirecting to home');
      setCurrentPage("home");
    }
    // If we're on order-confirmation but no order ID, go to home
    if (currentPage === "order-confirmation" && !currentOrderId) {
      console.log('⚠️ Invalid state: order-confirmation without orderId, redirecting to home');
      setCurrentPage("home");
    }
    // If we're on reset-password but no token, go to home
    if (currentPage === "reset-password" && !resetToken) {
      console.log('⚠️ Invalid state: reset-password without token, redirecting to home');
      setCurrentPage("home");
    }
  }, []); // Run once on mount

  // SECURITY: Clean up old global localStorage keys on app load
  useEffect(() => {
    const cleanupOldStorage = () => {
      const oldGlobalOrders = localStorage.getItem('fashionOrders');
      const oldGlobalWishlist = localStorage.getItem('fashionWishlist');
      
      if (oldGlobalOrders || oldGlobalWishlist) {
        console.log('🧹 Detected old global storage keys - cleaning up...');
        
        // Remove old global keys (they're insecure and cause data leakage)
        if (oldGlobalOrders) {
          localStorage.removeItem('fashionOrders');
          console.log('🗑️ Removed old global fashionOrders key');
        }
        if (oldGlobalWishlist) {
          localStorage.removeItem('fashionWishlist');
          console.log('🗑️ Removed old global fashionWishlist key');
        }
        
        console.log('✅ Cleanup complete - all data is now user-specific');
      }
    };
    
    cleanupOldStorage();
  }, []);

  // Auth modal is now only shown when user explicitly clicks login/signup or tries to checkout

  // Check for reset password token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset');
    if (token) {
      setResetToken(token);
      setCurrentPage('reset-password');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault()
        console.log("🔑 Admin shortcut pressed. Current isAdminMode:", isAdminMode)
        const adminPassword = prompt("Enter admin password:")
        if (adminPassword === "admin123") {
          console.log("✅ Correct password! Opening admin dashboard...")
          setAdminMode(true)
        } else if (adminPassword) {
          console.log("❌ Incorrect password")
          alert("Incorrect password!")
        }
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [isAdminMode, setAdminMode])

  const handleViewProduct = (productId: number) => {
    setSelectedProductId(productId)
    setCurrentPage("product-detail")
  }

  const handleNavigateHome = () => {
    setCurrentPage("home")
    setSelectedProductId(null)
  }

  const handleNavigateToProducts = () => {
    setCurrentPage("products")
    setSelectedProductId(null)
  }

  const handleNavigateToSearch = () => {
    setCurrentPage("search")
    setSelectedProductId(null)
  }

  const handleNavigateToAbout = () => {
    setCurrentPage("about")
    setSelectedProductId(null)
  }

  const handleNavigateToContact = () => {
    setCurrentPage("contact")
    setSelectedProductId(null)
  }

  const handleNavigateToAccount = () => {
    setCurrentPage("my-account-dashboard")
    setSelectedProductId(null)
  }

  const handleNavigateToOrders = () => {
    setCurrentPage("orders")
    setSelectedProductId(null)
  }

  const handleNavigateToProfile = () => {
    setCurrentPage("profile")
    setSelectedProductId(null)
  }

  const handleNavigateToAddressBook = () => {
    setCurrentPage("address-book")
    setSelectedProductId(null)
  }

  const handleNavigateToWallet = () => {
    setCurrentPage("wallet")
    setSelectedProductId(null)
  }

  const handleNavigateToWishlist = () => {
    setCurrentPage("wishlist")
    setSelectedProductId(null)
  }

  const handleNavigateToSettings = () => {
    setCurrentPage("settings")
    setSelectedProductId(null)
  }

  const handleNavigateToShipping = () => {
    setCurrentPage("shipping")
    setSelectedProductId(null)
  }

  const handleNavigateToFAQ = () => {
    setCurrentPage("faq")
    setSelectedProductId(null)
  }

  const handleNavigateToSustainability = () => {
    setCurrentPage("sustainability")
    setSelectedProductId(null)
  }

  const handleNavigateToTrackOrder = () => {
    setCurrentPage("track-order")
    setSelectedProductId(null)
  }

  const handleNavigateToPrivacyPolicy = () => {
    setCurrentPage("privacy-policy")
    setSelectedProductId(null)
  }

  const handleNavigateToTermsOfService = () => {
    setCurrentPage("terms-of-service")
    setSelectedProductId(null)
  }

  const handleNavigateToCookiePolicy = () => {
    setCurrentPage("cookie-policy")
    setSelectedProductId(null)
  }

  const handleNavigateToCart = () => {
    setCurrentPage("cart")
  }

  const handleNavigateToCheckout = () => {
    // Check if user is authenticated before allowing checkout
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    setCurrentPage("checkout")
  }

  const handleOrderPlaced = (orderId: string) => {
    console.log('🎯 handleOrderPlaced called with orderId:', orderId);
    
    if (!orderId) {
      console.error('❌ CRITICAL: orderId is undefined in handleOrderPlaced!');
      alert('❌ Error: Order ID is missing. Please check your browser console.');
      return;
    }
    
    setCurrentOrderId(orderId)
    setCurrentPage("order-confirmation")
    console.log('✅ Order confirmation page navigated with orderId:', orderId);
  }

  const handleCloseAuthModal = () => {
    // Close modal and navigate to home page
    setShowAuthModal(false)
    setCurrentPage("home")
  }

  console.log("🎯 App render - isAdminMode:", isAdminMode)

  if (isAdminMode) {
    console.log("🔧 Rendering AdminDashboard")
    return (
      <Suspense fallback={<PageLoader />}>
        <AdminDashboard onClose={() => {
          console.log("🚪 Closing admin dashboard")
          setAdminMode(false)
        }} />
      </Suspense>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-neutral-100">
        <Header
          onNavigateToProducts={handleNavigateToProducts}
          onNavigateToCart={handleNavigateToCart}
          onNavigateHome={handleNavigateHome}
          onNavigateToSearch={handleNavigateToSearch}
          onNavigateToAbout={handleNavigateToAbout}
          onNavigateToAccount={handleNavigateToAccount}
          onNavigateToOrders={handleNavigateToOrders}
          onNavigateToProfile={handleNavigateToProfile}
          onNavigateToContact={handleNavigateToContact}
          onNavigateToWishlist={handleNavigateToWishlist}
          onNavigateToSettings={handleNavigateToSettings}
          onShowAuthModal={() => setShowAuthModal(true)}
        />

        {currentPage === "home" && (
          <>
            <HeroSection onViewShowroom={handleNavigateToProducts} />
            <ProductDetailsSection />
            <InfoSections onNavigateToShipping={handleNavigateToShipping} onNavigateToFAQ={handleNavigateToFAQ} />
            <RecommendedProducts onViewAll={handleNavigateToProducts} />
            <Suspense fallback={null}>
              <RecentlyViewedSection onViewProduct={handleViewProduct} />
            </Suspense>
          </>
        )}

        {currentPage === "search" && (
          <Suspense fallback={<PageLoader />}>
            <SearchPage onNavigateHome={handleNavigateHome} onViewProduct={handleViewProduct} />
          </Suspense>
        )}

        {currentPage === "products" && (
          <Suspense fallback={<PageLoader />}>
            <AdminProductsPage onNavigateHome={handleNavigateHome} onViewProduct={handleViewProduct} />
          </Suspense>
        )}

        {currentPage === "product-detail" && selectedProductId && (
          <Suspense fallback={<PageLoader />}>
            <ProductDetailPage
              productId={selectedProductId}
              onNavigateBack={handleNavigateToProducts}
              onNavigateToCart={handleNavigateToCart}
            />
          </Suspense>
        )}

        {currentPage === "cart" && (
          <Suspense fallback={<PageLoader />}>
            <CartPage
              onNavigateHome={handleNavigateHome}
              onContinueShopping={handleNavigateToProducts}
              onProceedToCheckout={handleNavigateToCheckout}
            />
          </Suspense>
        )}

        {currentPage === "checkout" && (
          <Suspense fallback={<PageLoader />}>
            <CheckoutPage onNavigateBack={handleNavigateToCart} onOrderPlaced={handleOrderPlaced} />
          </Suspense>
        )}

        {currentPage === "order-confirmation" && (
          <Suspense fallback={<PageLoader />}>
            <OrderConfirmationPage
              orderId={currentOrderId}
              onNavigateHome={handleNavigateHome}
              onContinueShopping={handleNavigateToProducts}
            />
          </Suspense>
        )}

        {currentPage === "about" && (
          <Suspense fallback={<PageLoader />}>
            <AboutUsPage onNavigateHome={handleNavigateHome} />
          </Suspense>
        )}

        {currentPage === "contact" && (
          <Suspense fallback={<PageLoader />}>
            <ContactUsPage onNavigateHome={handleNavigateHome} onNavigateFAQ={handleNavigateToFAQ} />
          </Suspense>
        )}

        {currentPage === "account" && (
          <Suspense fallback={<PageLoader />}>
            <AccountPage
              onNavigateHome={handleNavigateHome}
              onNavigateToOrders={handleNavigateToOrders}
              onNavigateToProfile={handleNavigateToProfile}
              onNavigateToSettings={handleNavigateToSettings}
            />
          </Suspense>
        )}

        {currentPage === "my-account-dashboard" && (
          <Suspense fallback={<PageLoader />}>
            <MyAccountDashboard
              onNavigateHome={handleNavigateHome}
              onNavigateToOrders={handleNavigateToOrders}
              onNavigateToProfile={handleNavigateToProfile}
              onNavigateToSettings={handleNavigateToSettings}
              onNavigateToAddressBook={handleNavigateToAddressBook}
              onNavigateToWishlist={handleNavigateToWishlist}
            />
          </Suspense>
        )}

        {currentPage === "address-book" && (
          <Suspense fallback={<PageLoader />}>
            <AddressBookPage onNavigateBack={handleNavigateToAccount} />
          </Suspense>
        )}

        {currentPage === "wallet" && (
          <Suspense fallback={<PageLoader />}>
            <WalletPage onNavigateBack={handleNavigateToAccount} />
          </Suspense>
        )}

        {currentPage === "orders" && (
          <Suspense fallback={<PageLoader />}>
            <OrdersPage onNavigateHome={handleNavigateHome} onViewProduct={handleViewProduct} />
          </Suspense>
        )}

        {currentPage === "profile" && (
          <Suspense fallback={<PageLoader />}>
            <ProfilePage onNavigateHome={handleNavigateToAccount} />
          </Suspense>
        )}

        {currentPage === "wishlist" && (
          <Suspense fallback={<PageLoader />}>
            <WishlistPage onNavigateHome={handleNavigateToProducts} onViewProduct={handleViewProduct} />
          </Suspense>
        )}

        {currentPage === "settings" && (
          <Suspense fallback={<PageLoader />}>
            <SettingsPage onNavigateHome={handleNavigateToAccount} />
          </Suspense>
        )}

        {currentPage === "shipping" && (
          <Suspense fallback={<PageLoader />}>
            <ShippingInfoPage onNavigateHome={handleNavigateHome} />
          </Suspense>
        )}

        {currentPage === "faq" && (
          <Suspense fallback={<PageLoader />}>
            <FAQPage onNavigateHome={handleNavigateHome} />
          </Suspense>
        )}

        {currentPage === "privacy-policy" && (
          <Suspense fallback={<PageLoader />}>
            <PrivacyPolicyPage onNavigateHome={handleNavigateHome} />
          </Suspense>
        )}

        {currentPage === "terms-of-service" && (
          <Suspense fallback={<PageLoader />}>
            <TermsOfServicePage onNavigateHome={handleNavigateHome} />
          </Suspense>
        )}

        {currentPage === "cookie-policy" && (
          <Suspense fallback={<PageLoader />}>
            <CookiePolicyPage onNavigateHome={handleNavigateHome} />
          </Suspense>
        )}

        {currentPage === "sustainability" && (
          <Suspense fallback={<PageLoader />}>
            <SustainabilityPage onNavigateHome={handleNavigateHome} onNavigateToProducts={handleNavigateToProducts} />
          </Suspense>
        )}

        {currentPage === "reset-password" && resetToken && (
          <Suspense fallback={<PageLoader />}>
            <ResetPasswordPage
              token={resetToken}
              onSuccess={() => {
                setResetToken('');
                setCurrentPage("home");
              }}
            />
          </Suspense>
        )}

        {currentPage === "track-order" && (
          <Suspense fallback={<PageLoader />}>
            <OrderTrackingPage onNavigateBack={handleNavigateHome} />
          </Suspense>
        )}

        <Footer
          onNavigateToAbout={handleNavigateToAbout}
          onNavigateToSustainability={handleNavigateToSustainability}
          onNavigateToProducts={handleNavigateToProducts}
          onNavigateToTrackOrder={handleNavigateToTrackOrder}
          onNavigateToPrivacyPolicy={handleNavigateToPrivacyPolicy}
          onNavigateToTermsOfService={handleNavigateToTermsOfService}
          onNavigateToCookiePolicy={handleNavigateToCookiePolicy}
        />
      </div>

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={handleCloseAuthModal} />}
    </>
  )
}

export default function App() {
  console.log("App component rendering...");
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AdminProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </AdminProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}