import { ChevronLeft } from 'lucide-react';

interface PrivacyPolicyPageProps {
  onNavigateHome: () => void;
}

export function PrivacyPolicyPage({ onNavigateHome }: PrivacyPolicyPageProps) {
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

        <h1 className="text-4xl tracking-wider mb-8">PRIVACY POLICY</h1>
        
        <div className="space-y-6 text-neutral-700">
          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">1. Information We Collect</h2>
            <p className="mb-4">
              We collect information you provide directly to us when you create an account, make a purchase, 
              or communicate with us. This includes:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Name, email address, and phone number</li>
              <li>Shipping and billing addresses</li>
              <li>Payment information (processed securely through our payment providers)</li>
              <li>Purchase history and preferences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">2. How We Use Your Information</h2>
            <p className="mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Process and fulfill your orders</li>
              <li>Send order confirmations and updates</li>
              <li>Respond to your requests and inquiries</li>
              <li>Send marketing communications (with your consent)</li>
              <li>Improve our products and services</li>
              <li>Detect and prevent fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">3. Information Sharing</h2>
            <p className="mb-4">
              We do not sell your personal information. We may share your information with:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Service providers who help us operate our business</li>
              <li>Shipping carriers to deliver your orders</li>
              <li>Payment processors to handle transactions</li>
              <li>Law enforcement when required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal 
              information against unauthorized access, alteration, disclosure, or destruction. All payment 
              information is encrypted using industry-standard SSL technology.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">5. Your Rights</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Opt-out of marketing communications</li>
              <li>Request data portability</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">6. Cookies</h2>
            <p>
              We use cookies and similar technologies to enhance your browsing experience, analyze site traffic, 
              and personalize content. You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section>
            <h2 className="text-2xl tracking-wider mb-4 text-black">7. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="mt-4">
              <strong>Email:</strong> privacy@shringarika.com<br />
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
