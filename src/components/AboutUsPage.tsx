import { ChevronLeft, Mail, Phone, MapPin, Clock } from 'lucide-react';

interface AboutUsPageProps {
  onNavigateHome: () => void;
}

export function AboutUsPage({ onNavigateHome }: AboutUsPageProps) {
  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <button 
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-sm hover:underline mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>BACK TO HOME</span>
          </button>
          
          <h1 className="text-5xl tracking-wider mb-2">ABOUT US</h1>
          <p className="text-neutral-600">Discover our story and values</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="space-y-12">
          {/* Our Story */}
          <section>
            <h2 className="text-3xl tracking-wider mb-6">OUR STORY</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              Shringarika was founded with a passion for bringing traditional elegance to modern fashion. 
              We believe in celebrating heritage through contemporary designs that speak to the soul of 
              traditional wear.
            </p>
            <p className="text-neutral-700 leading-relaxed">
              Each piece in our collection is carefully curated to reflect the rich cultural tapestry 
              of traditional fashion, while maintaining the comfort and style that modern wearers demand.
            </p>
          </section>

          {/* Our Values */}
          <section>
            <h2 className="text-3xl tracking-wider mb-6">OUR VALUES</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-neutral-50 rounded-lg">
                <h3 className="text-xl tracking-wider mb-3">Quality</h3>
                <p className="text-neutral-600">
                  We source only the finest materials and work with skilled artisans to ensure 
                  every piece meets our high standards.
                </p>
              </div>
              <div className="p-6 bg-neutral-50 rounded-lg">
                <h3 className="text-xl tracking-wider mb-3">Authenticity</h3>
                <p className="text-neutral-600">
                  Our designs honor traditional craftsmanship while embracing contemporary aesthetics.
                </p>
              </div>
              <div className="p-6 bg-neutral-50 rounded-lg">
                <h3 className="text-xl tracking-wider mb-3">Sustainability</h3>
                <p className="text-neutral-600">
                  We're committed to ethical practices and sustainable production methods.
                </p>
              </div>
              <div className="p-6 bg-neutral-50 rounded-lg">
                <h3 className="text-xl tracking-wider mb-3">Customer First</h3>
                <p className="text-neutral-600">
                  Your satisfaction and experience are at the heart of everything we do.
                </p>
              </div>
            </div>
          </section>

          {/* Contact Info */}
          <section>
            <h2 className="text-3xl tracking-wider mb-6">GET IN TOUCH</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <MapPin className="w-5 h-5 text-neutral-600 mt-1" />
                <div>
                  <p className="font-medium tracking-wider mb-1">Address</p>
                  <p className="text-neutral-600">123 Fashion Street, Mumbai, India 400001</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Phone className="w-5 h-5 text-neutral-600 mt-1" />
                <div>
                  <p className="font-medium tracking-wider mb-1">Phone</p>
                  <p className="text-neutral-600">+91 98765 43210</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Mail className="w-5 h-5 text-neutral-600 mt-1" />
                <div>
                  <p className="font-medium tracking-wider mb-1">Email</p>
                  <p className="text-neutral-600">hello@shringarika.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Clock className="w-5 h-5 text-neutral-600 mt-1" />
                <div>
                  <p className="font-medium tracking-wider mb-1">Hours</p>
                  <p className="text-neutral-600">Monday - Saturday: 10:00 AM - 8:00 PM</p>
                  <p className="text-neutral-600">Sunday: Closed</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
