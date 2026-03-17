import { ChevronLeft, Cookie } from 'lucide-react';
import { useState } from 'react';

interface CookiePolicyPageProps {
  onNavigateHome: () => void;
}

export function CookiePolicyPage({ onNavigateHome }: CookiePolicyPageProps) {
  const [cookiePreferences, setCookiePreferences] = useState({
    necessary: true,
    analytics: true,
    marketing: false,
  });

  const handleSavePreferences = () => {
    localStorage.setItem('cookiePreferences', JSON.stringify(cookiePreferences));
    alert('Cookie preferences saved successfully!');
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <button 
          onClick={onNavigateHome}
          className="flex items-center gap-2 text-sm hover:underline mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>BACK TO HOME</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <Cookie className="w-10 h-10" />
          <h1 className="text-4xl tracking-wider">COOKIE POLICY</h1>
        </div>
        
        <div className="space-y-6 text-neutral-700">
          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">What Are Cookies?</h2>
            <p>
              Cookies are small text files that are stored on your device when you visit our website. They help us 
              provide you with a better experience by remembering your preferences and enabling certain functionalities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">Types of Cookies We Use</h2>
            
            <div className="space-y-4">
              <div className="border border-neutral-200 rounded p-4">
                <h3 className="font-semibold text-black mb-2">1. Necessary Cookies (Always Active)</h3>
                <p className="text-sm mb-2">
                  These cookies are essential for the website to function properly. They enable basic features like 
                  page navigation, secure areas access, and shopping cart functionality.
                </p>
                <p className="text-xs text-neutral-600">
                  Examples: Session management, authentication, security
                </p>
              </div>

              <div className="border border-neutral-200 rounded p-4">
                <h3 className="font-semibold text-black mb-2">2. Analytics Cookies</h3>
                <p className="text-sm mb-2">
                  These cookies help us understand how visitors interact with our website by collecting anonymous 
                  information about pages visited, time spent, and any errors encountered.
                </p>
                <p className="text-xs text-neutral-600">
                  Examples: Google Analytics, page performance tracking
                </p>
              </div>

              <div className="border border-neutral-200 rounded p-4">
                <h3 className="font-semibold text-black mb-2">3. Marketing Cookies</h3>
                <p className="text-sm mb-2">
                  These cookies track your online activity to help deliver relevant advertisements and measure the 
                  effectiveness of our marketing campaigns.
                </p>
                <p className="text-xs text-neutral-600">
                  Examples: Social media cookies, advertising networks
                </p>
              </div>

              <div className="border border-neutral-200 rounded p-4">
                <h3 className="font-semibold text-black mb-2">4. Preference Cookies</h3>
                <p className="text-sm mb-2">
                  These cookies remember your settings and preferences, such as language, region, and display options, 
                  to provide a personalized experience.
                </p>
                <p className="text-xs text-neutral-600">
                  Examples: Language preferences, theme settings, recently viewed items
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">Manage Cookie Preferences</h2>
            <p className="mb-6">
              You can control which cookies we use by adjusting the settings below. Note that disabling certain 
              cookies may affect website functionality.
            </p>

            <div className="bg-neutral-50 border border-neutral-200 rounded p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-black">Necessary Cookies</h3>
                  <p className="text-sm text-neutral-600">Required for website operation</p>
                </div>
                <div className="bg-neutral-300 px-4 py-2 rounded text-sm">
                  Always Active
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                <div>
                  <h3 className="font-semibold text-black">Analytics Cookies</h3>
                  <p className="text-sm text-neutral-600">Help us improve our website</p>
                </div>
                <button
                  onClick={() => setCookiePreferences(prev => ({ ...prev, analytics: !prev.analytics }))}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    cookiePreferences.analytics ? 'bg-black' : 'bg-neutral-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      cookiePreferences.analytics ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                <div>
                  <h3 className="font-semibold text-black">Marketing Cookies</h3>
                  <p className="text-sm text-neutral-600">Personalized advertisements</p>
                </div>
                <button
                  onClick={() => setCookiePreferences(prev => ({ ...prev, marketing: !prev.marketing }))}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    cookiePreferences.marketing ? 'bg-black' : 'bg-neutral-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      cookiePreferences.marketing ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={handleSavePreferences}
                className="w-full mt-6 bg-black text-white py-3 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
              >
                SAVE PREFERENCES
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">Third-Party Cookies</h2>
            <p className="mb-4">
              We may use third-party services that set their own cookies on our website:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Google Analytics - for website analytics</li>
              <li>Payment processors - for secure transactions</li>
              <li>Social media platforms - for sharing functionality</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">How to Control Cookies</h2>
            <p className="mb-4">
              You can control cookies through your browser settings:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Most browsers allow you to refuse cookies or delete cookies</li>
              <li>Browser settings can usually be found in the "Help", "Tools", or "Edit" menu</li>
              <li>Blocking all cookies may prevent access to certain features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">Updates to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time. We encourage you to review this page periodically 
              for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">Contact Us</h2>
            <p>
              If you have questions about our use of cookies, contact us at:
            </p>
            <p className="mt-4">
              <strong>Email:</strong> privacy@shringarika.com<br />
              <strong>Phone:</strong> +91-1800-123-4567
            </p>
          </section>

          <section className="pt-6 border-t border-neutral-200">
            <p className="text-sm text-neutral-600">
              Last updated: December 24, 2025
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
