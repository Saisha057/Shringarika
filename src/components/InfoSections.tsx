import { ArrowRight } from 'lucide-react';

interface InfoSectionsProps {
  onNavigateToShipping?: () => void;
  onNavigateToFAQ?: () => void;
}

export function InfoSections({ onNavigateToShipping, onNavigateToFAQ }: InfoSectionsProps) {
  return (
    <section className="bg-black text-white py-16">
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-2 gap-8">
          {/* Shipping Info */}
          <div className="space-y-4">
            <h3 className="text-2xl tracking-wider">SHIPPING</h3>
            <p className="text-neutral-400 text-sm leading-relaxed max-w-md">
              Orders are processed within 1-2 business days. Standard shipping takes 3-5 business days.
              Express shipping available at checkout. Free shipping on orders over Rs.1500.
            </p>
            <button 
              onClick={onNavigateToShipping}
              className="flex items-center gap-2 text-sm hover:gap-4 transition-all"
            >
              <span className="underline">READ MORE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* FAQ Topics */}
          <div className="relative">
            <div className="bg-neutral-800 p-8 rounded-lg">
              <h3 className="text-2xl tracking-wider mb-4">FAQ TOPICS</h3>
              <p className="text-neutral-400 text-sm mb-6">
                Find answers to commonly asked questions about sizing, returns, and care instructions.
              </p>
              <button 
                onClick={onNavigateToFAQ}
                className="flex items-center gap-2 text-sm hover:gap-4 transition-all mt-4"
              >
                <span className="underline">VIEW ALL FAQs</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Dot */}
        {/* <div className="flex justify-center mt-16">
          <button className="w-2 h-2 bg-white rounded-full"></button>
        </div> */}
      </div>
    </section>
  );
}
