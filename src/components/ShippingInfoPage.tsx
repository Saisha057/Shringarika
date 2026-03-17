import { ArrowLeft, Package, Clock, Globe, AlertCircle, RefreshCw } from 'lucide-react';

interface ShippingInfoPageProps {
  onNavigateHome: () => void;
}

export function ShippingInfoPage({ onNavigateHome }: ShippingInfoPageProps) {
  return (
    <div className="min-h-screen bg-neutral-50 animate-fadeIn">
      {/* Header with Back Button */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-sm tracking-wider hover:underline transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>HOME</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Page Title */}
        <div className="mb-12">
          <h1 className="text-4xl tracking-widest mb-4">SHIPPING INFORMATION</h1>
          <p className="text-neutral-600 text-lg">
            Everything you need to know about our shipping policies and delivery times.
          </p>
        </div>

        {/* Delivery Times Section */}
        <section className="mb-12 bg-white rounded-lg p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-6 h-6" />
            <h2 className="text-2xl tracking-wider">Delivery Time Ranges</h2>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Domestic Shipping (Within India)</h3>
              <ul className="space-y-2 text-neutral-700">
                <li className="flex items-start gap-2">
                  <span className="text-black mt-1">•</span>
                  <span><strong>Standard Delivery:</strong> 5-7 business days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-black mt-1">•</span>
                  <span><strong>Express Delivery:</strong> 2-3 business days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-black mt-1">•</span>
                  <span><strong>Same-Day Delivery:</strong> Available in select metro cities (Mumbai, Delhi, Bangalore, Hyderabad)</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2">International Shipping</h3>
              <ul className="space-y-2 text-neutral-700">
                <li className="flex items-start gap-2">
                  <span className="text-black mt-1">•</span>
                  <span><strong>Asia Pacific:</strong> 7-10 business days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-black mt-1">•</span>
                  <span><strong>Europe & USA:</strong> 10-15 business days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-black mt-1">•</span>
                  <span><strong>Rest of World:</strong> 12-20 business days</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Packaging Details Section */}
        <section className="mb-12 bg-white rounded-lg p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Package className="w-6 h-6" />
            <h2 className="text-2xl tracking-wider">Packaging Details</h2>
          </div>
          <div className="space-y-4 text-neutral-700">
            <p>
              All our jewelry pieces are packaged with the utmost care to ensure they reach you in perfect condition:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>Each piece is wrapped in premium tissue paper and placed in a signature Shringarika box</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>Delicate items receive additional protective padding</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>All packages are sealed with tamper-evident tape for security</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>Eco-friendly, recyclable packaging materials are used whenever possible</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>Gift wrapping available upon request at checkout</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Handling Time Section */}
        <section className="mb-12 bg-white rounded-lg p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <RefreshCw className="w-6 h-6" />
            <h2 className="text-2xl tracking-wider">Processing & Handling Time</h2>
          </div>
          <div className="space-y-4 text-neutral-700">
            <p>
              Orders are processed Monday through Friday (excluding public holidays):
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span><strong>In-Stock Items:</strong> Processed within 1-2 business days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span><strong>Made-to-Order Items:</strong> 7-10 business days before shipping</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span><strong>Custom Designs:</strong> 15-21 business days (timeline provided during consultation)</span>
              </li>
            </ul>
            <p className="mt-4 text-sm">
              <strong>Note:</strong> Orders placed after 2 PM IST will be processed the next business day.
            </p>
          </div>
        </section>

        {/* International Shipping Breakdown */}
        <section className="mb-12 bg-white rounded-lg p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-6 h-6" />
            <h2 className="text-2xl tracking-wider">International Shipping Details</h2>
          </div>
          <div className="space-y-4 text-neutral-700">
            <p>
              We ship to over 50 countries worldwide. International orders include:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>Full tracking information provided via email</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>Customs documentation handled by our shipping partners</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>Import duties and taxes are the responsibility of the recipient</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>Declared value based on purchase price for customs clearance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>Signature required upon delivery for security</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Shipping Restrictions Section */}
        <section className="mb-12 bg-white rounded-lg p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-2xl tracking-wider">Shipping Restrictions</h2>
          </div>
          <div className="space-y-4 text-neutral-700">
            <p>
              Please note the following restrictions and considerations:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>We do not ship to P.O. boxes for high-value orders (above ₹25,000)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>Certain countries may have restrictions on jewelry imports - please check local regulations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>Orders to remote or restricted areas may require additional delivery time</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>During peak seasons (Diwali, Christmas, Valentine's Day), delivery times may be extended by 2-3 days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span>APO/FPO addresses: Please contact customer service for special arrangements</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Return & Exchange Shipping Section */}
        <section className="mb-12 bg-white rounded-lg p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <RefreshCw className="w-6 h-6" />
            <h2 className="text-2xl tracking-wider">Return & Exchange Shipping</h2>
          </div>
          <div className="space-y-4 text-neutral-700">
            <p>
              Our return and exchange policy includes the following shipping guidelines:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span><strong>Free Return Shipping:</strong> Available within India for orders above ₹5,000</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span><strong>Exchange Orders:</strong> New item shipped at no additional cost once original is received</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span><strong>International Returns:</strong> Customer is responsible for return shipping costs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span><strong>Return Window:</strong> 30 days from delivery date</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black mt-1">•</span>
                <span><strong>Refund Processing:</strong> 5-7 business days after return is received and inspected</span>
              </li>
            </ul>
            <p className="mt-4 text-sm">
              All returns must be in original condition with tags and packaging intact.
            </p>
          </div>
        </section>

        {/* Delivery Chart Section */}
        <section className="mb-12 bg-white rounded-lg p-8 shadow-sm">
          <h2 className="text-2xl tracking-wider mb-6">Estimated Delivery Chart</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="border border-neutral-300 px-4 py-3 text-left">Region</th>
                  <th className="border border-neutral-300 px-4 py-3 text-left">Standard</th>
                  <th className="border border-neutral-300 px-4 py-3 text-left">Express</th>
                  <th className="border border-neutral-300 px-4 py-3 text-left">Cost (₹)</th>
                </tr>
              </thead>
              <tbody className="text-neutral-700">
                <tr>
                  <td className="border border-neutral-300 px-4 py-3">Metro Cities</td>
                  <td className="border border-neutral-300 px-4 py-3">5-7 days</td>
                  <td className="border border-neutral-300 px-4 py-3">2-3 days</td>
                  <td className="border border-neutral-300 px-4 py-3">Free / ₹150</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 px-4 py-3">Tier 2 Cities</td>
                  <td className="border border-neutral-300 px-4 py-3">6-8 days</td>
                  <td className="border border-neutral-300 px-4 py-3">3-4 days</td>
                  <td className="border border-neutral-300 px-4 py-3">Free / ₹200</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 px-4 py-3">Rest of India</td>
                  <td className="border border-neutral-300 px-4 py-3">7-10 days</td>
                  <td className="border border-neutral-300 px-4 py-3">4-5 days</td>
                  <td className="border border-neutral-300 px-4 py-3">Free / ₹250</td>
                </tr>
                <tr>
                  <td className="border border-neutral-300 px-4 py-3">International</td>
                  <td className="border border-neutral-300 px-4 py-3">10-20 days</td>
                  <td className="border border-neutral-300 px-4 py-3">7-10 days</td>
                  <td className="border border-neutral-300 px-4 py-3">Calculated at checkout</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-neutral-600">
            *Standard shipping is free for orders above ₹2,500. Express shipping charges apply.
          </p>
        </section>

        {/* Contact Section */}
        <section className="bg-neutral-100 rounded-lg p-8">
          <h2 className="text-2xl tracking-wider mb-4">Need More Help?</h2>
          <p className="text-neutral-700 mb-6">
            If you have questions about your shipment or need assistance, our customer service team is here to help.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={onNavigateHome}
              className="px-6 py-3 bg-black text-white tracking-wider hover:bg-neutral-800 transition-colors"
            >
              BACK TO HOME
            </button>
            <a
              href="mailto:support@shringarika.com"
              className="px-6 py-3 border border-black tracking-wider hover:bg-black hover:text-white transition-colors"
            >
              CONTACT SUPPORT
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
