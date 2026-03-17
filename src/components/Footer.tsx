"use client"

import { Phone, Mail, MapPin, Instagram, Facebook } from "lucide-react"

interface FooterProps {
  onNavigateToAbout?: () => void
  onNavigateToSustainability?: () => void
  onNavigateToProducts?: () => void
  onNavigateToTrackOrder?: () => void
  onNavigateToPrivacyPolicy?: () => void
  onNavigateToTermsOfService?: () => void
  onNavigateToCookiePolicy?: () => void
}

export function Footer({ 
  onNavigateToAbout, 
  onNavigateToSustainability, 
  onNavigateToProducts, 
  onNavigateToTrackOrder,
  onNavigateToPrivacyPolicy,
  onNavigateToTermsOfService,
  onNavigateToCookiePolicy
}: FooterProps) {
  return (
    <footer className="bg-black text-white py-8 md:py-16 px-3 sm:px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-6 md:gap-8 mb-8 md:mb-16">
          {/* Navigation Links - Left */}
          <div className="sm:col-span-1 md:col-span-3 space-y-4 md:space-y-8">
            <div>
              <h3 className="text-xs md:text-sm tracking-wider mb-3 md:mb-4">SHOP</h3>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-neutral-400">
                <li>
                  <button onClick={onNavigateToProducts} className="hover:text-white text-left">
                    NEW IN
                  </button>
                </li>
                <li>
                  <button onClick={onNavigateToProducts} className="hover:text-white text-left">
                    CLOTHING
                  </button>
                </li>
                <li>
                  <button onClick={onNavigateToProducts} className="hover:text-white text-left">
                    ACCESSORIES
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="sm:col-span-1 md:col-span-3 space-y-4 md:space-y-8">
            <div>
              <button
                onClick={onNavigateToAbout}
                className="text-xs md:text-sm tracking-wider mb-3 md:mb-4 hover:text-neutral-400 transition-colors block"
              >
                ABOUT
              </button>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-neutral-400">
                <li>
                  <button onClick={onNavigateToAbout} className="hover:text-white text-left">
                    OUR STORY
                  </button>
                </li>
                <li>
                  <button onClick={onNavigateToSustainability} className="hover:text-white text-left">
                    SUSTAINABILITY
                  </button>
                </li>
                <li>
                  <button onClick={onNavigateToTrackOrder} className="hover:text-white text-left">
                    TRACK ORDER
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Get In Touch */}
          <div className="sm:col-span-2 md:col-span-6">
            <h2 className="text-2xl sm:text-3xl md:text-4xl tracking-wider mb-4 md:mb-8">GET IN TOUCH</h2>

            <div className="space-y-3 md:space-y-4">
              <div className="flex items-start gap-2 md:gap-3">
                <Phone className="w-4 h-4 md:w-5 md:h-5 mt-0.5 md:mt-1 shrink-0" />
                <div>
                  <p className="text-xs md:text-sm text-neutral-400">PHONE</p>
                  <p className="text-xs md:text-sm">+91-8299103181</p>
                </div>
              </div>

              <div className="flex items-start gap-2 md:gap-3">
                <Mail className="w-4 h-4 md:w-5 md:h-5 mt-0.5 md:mt-1 shrink-0" />
                <div>
                  <p className="text-xs md:text-sm text-neutral-400">EMAIL</p>
                  <p className="text-xs md:text-sm break-all">shringarika11@gmail.com</p>
                </div>
              </div>

              <div className="flex items-start gap-2 md:gap-3">
                <MapPin className="w-4 h-4 md:w-5 md:h-5 mt-0.5 md:mt-1 shrink-0" />
                <div>
                  <p className="text-xs md:text-sm text-neutral-400">ADDRESS</p>
                  <p className="text-xs md:text-sm">Shringarika Fashion Hub,</p>
                  <p className="text-xs md:text-sm">Gomti Nagar, Lucknow, Uttar Pradesh 226010</p>
                </div>
              </div>

              {/* Social Media */}
              <div className="flex gap-3 md:gap-4 pt-2 md:pt-4">
                <button className="w-7 h-7 md:w-8 md:h-8 border border-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-colors">
                  <Instagram className="w-3 h-3 md:w-4 md:h-4" />
                </button>
                <button className="w-7 h-7 md:w-8 md:h-8 border border-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-colors">
                  <Facebook className="w-3 h-3 md:w-4 md:h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-neutral-800 pt-6 md:pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 md:gap-8">
            <button onClick={onNavigateToPrivacyPolicy} className="hover:text-white text-left">
              PRIVACY POLICY
            </button>
            <button onClick={onNavigateToTermsOfService} className="hover:text-white text-left">
              TERMS OF SERVICE
            </button>
            <button onClick={onNavigateToCookiePolicy} className="hover:text-white text-left">
              COOKIE POLICY
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span>{new Date().getFullYear()} ©</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
