import { ChevronLeft } from 'lucide-react';

interface TermsOfServicePageProps {
  onNavigateHome: () => void;
}

export function TermsOfServicePage({ onNavigateHome }: TermsOfServicePageProps) {
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

        <h1 className="text-4xl tracking-wider mb-8">TERMS OF SERVICE</h1>
        
        <div className="space-y-6 text-neutral-700">
          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Shringarika's website and services, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">2. Use of Services</h2>
            <p className="mb-4">You agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate and complete information when creating an account</li>
              <li>Maintain the security of your account credentials</li>
              <li>Not use our services for any illegal or unauthorized purpose</li>
              <li>Not interfere with or disrupt our services</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">3. Products and Pricing</h2>
            <p className="mb-4">
              We strive to display accurate product information and pricing. However:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Product colors may vary slightly from images due to screen settings</li>
              <li>Prices are subject to change without notice</li>
              <li>We reserve the right to limit quantities</li>
              <li>Product availability is not guaranteed until payment is confirmed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">4. Orders and Payment</h2>
            <p className="mb-4">
              By placing an order, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate billing and shipping information</li>
              <li>Pay all charges at the prices in effect when you place your order</li>
              <li>Pay any applicable taxes</li>
            </ul>
            <p className="mt-4">
              We reserve the right to refuse or cancel orders for any reason, including suspected fraud, 
              product unavailability, or errors in pricing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">5. Shipping and Delivery</h2>
            <p>
              Estimated delivery times are provided at checkout. We are not responsible for delays caused by 
              shipping carriers or circumstances beyond our control. Risk of loss passes to you upon delivery 
              to the shipping carrier.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">6. Returns and Refunds</h2>
            <p className="mb-4">
              We accept returns within 7 days of delivery for unworn, unwashed items with original tags. 
              Refunds will be processed within 5-7 business days of receiving the returned item. 
              Shipping costs are non-refundable unless the return is due to our error.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">7. Intellectual Property</h2>
            <p>
              All content on this website, including text, images, logos, and designs, is the property of 
              Shringarika and protected by copyright and trademark laws. You may not use, reproduce, or 
              distribute any content without our prior written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Shringarika shall not be liable for any indirect, 
              incidental, special, or consequential damages arising from your use of our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">9. Governing Law</h2>
            <p>
              These Terms of Service are governed by the laws of India. Any disputes shall be subject to 
              the exclusive jurisdiction of the courts in Mumbai, India.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms of Service at any time. Continued use of our 
              services after changes constitutes acceptance of the modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">11. Contact Information</h2>
            <p>
              For questions about these Terms of Service, contact us at:
            </p>
            <p className="mt-4">
              <strong>Email:</strong> legal@shringarika.com<br />
              <strong>Phone:</strong> +91-1800-123-4567<br />
              <strong>Address:</strong> Shringarika Fashion Pvt. Ltd., Mumbai, India
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
