"use client"

import { Search, ShoppingBag, Menu, User, LogOut, ChevronDown } from "lucide-react"
import { useState } from "react"
import { useCart } from "../context/CartContext"
import { useAuth } from "../context/AuthContext"
import { MenuDrawer } from "./MenuDrawer"

interface HeaderProps {
  onNavigateToProducts: () => void
  onNavigateToCart: () => void
  onNavigateHome: () => void
  onNavigateToSearch: () => void
  onNavigateToAbout: () => void
  onNavigateToAccount: () => void
  onNavigateToOrders: () => void
  onNavigateToProfile: () => void
  onNavigateToContact: () => void
  onNavigateToWishlist: () => void
  onNavigateToSettings: () => void
  onShowAuthModal: () => void
}

export function Header({
  onNavigateToProducts,
  onNavigateToCart,
  onNavigateHome,
  onNavigateToSearch,
  onNavigateToAbout,
  onNavigateToAccount,
  onNavigateToOrders,
  onNavigateToProfile,
  onNavigateToContact,
  onNavigateToWishlist,
  onNavigateToSettings,
  onShowAuthModal,
}: HeaderProps) {
  const { getCartCount } = useCart()
  const { user, isAuthenticated, logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMenuDrawer, setShowMenuDrawer] = useState(false)
  const cartCount = getCartCount()

  // Debug: Log authentication state
  console.log('Header render - isAuthenticated:', isAuthenticated, 'user:', user)

  const handleLogout = () => {
    logout()
    setShowUserMenu(false)
    // Reload page to show auth modal
    window.location.reload()
  }

  return (
    <>
      <MenuDrawer
        isOpen={showMenuDrawer}
        onClose={() => setShowMenuDrawer(false)}
        onNavigateToProducts={onNavigateToProducts}
        onNavigateToAbout={onNavigateToAbout}
        onNavigateToAccount={onNavigateToAccount}
        onNavigateToOrders={onNavigateToOrders}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToContact={onNavigateToContact}
        onNavigateToWishlist={onNavigateToWishlist}
        onNavigateToSettings={onNavigateToSettings}
        onShowAuthModal={onShowAuthModal}
      />

      <header className="bg-neutral-100 border-b border-neutral-300 px-2 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto grid grid-cols-3 items-center">
          {/* Left - Menu */}
          <div className="flex items-center gap-3 md:gap-6 justify-self-start">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenuDrawer(!showMenuDrawer)
              }}
              className="p-1.5 md:p-2 hover:bg-neutral-200 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={onNavigateToProducts}
              className="text-xs md:text-sm tracking-wider hover:underline hidden sm:block"
            >
              SHOP ALL
            </button>
          </div>

          {/* Center - Logo */}
          <div className="flex justify-center min-w-0 px-2 md:px-0">
            <button onClick={onNavigateHome}>
              <h1 className="mobile-brand-text text-base sm:text-xl md:text-2xl lg:text-3xl tracking-wider md:tracking-widest hover:opacity-70 transition-opacity max-w-[120px] sm:max-w-[200px] md:max-w-none overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontFamily: 'TiroDevanagariMarathi, serif' }}>
                श्रृ<span style={{ color: 'red' }}>ं</span>गारिका
              </h1>
            </button>
          </div>

          {/* Right - Search, User, Cart */}
          <div className="flex items-center justify-end gap-1 sm:gap-2 md:gap-3 shrink-0 justify-self-end">
            <button
              onClick={onNavigateToSearch}
              className="p-1.5 md:p-2 hover:bg-neutral-200 rounded-full transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* User Menu */}
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowUserMenu(!showUserMenu)
                  }}
                  className="flex items-center gap-2 px-2 md:px-3 py-1.5 md:py-2 hover:bg-neutral-200 rounded-lg transition-colors"
                  aria-label="User menu"
                >
                  <User className="w-5 h-5" />
                  <span className="text-xs md:text-sm tracking-wider hidden lg:block">
                    {user.name.split(" ")[0]}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform hidden md:block ${showUserMenu ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 md:w-56 bg-white border border-neutral-300 rounded-lg shadow-lg overflow-hidden animate-fadeIn z-50">
                    <div className="p-3 md:p-4 border-b border-neutral-200">
                      <p className="text-xs md:text-sm tracking-wider mb-1">{user.name}</p>
                      <p className="text-xs text-neutral-600">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setShowUserMenu(false)
                          onNavigateToAccount()
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs md:text-sm text-left hover:bg-neutral-100 rounded transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <span>My Account</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs md:text-sm text-left text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button className="p-1.5 md:p-2">
                <User className="w-5 h-5" />
              </button>
            )}

            <button onClick={onNavigateToCart} className="relative p-1.5 md:p-2">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center rounded-full bg-black text-white text-xs font-medium leading-none">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Close user menu when clicking outside */}
        {showUserMenu && <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />}

        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .animate-fadeIn {
            animation: fadeIn 0.2s ease-out;
          }
        `}</style>
      </header>
    </>
  )
}
