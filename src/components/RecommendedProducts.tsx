import { ArrowRight } from 'lucide-react';

interface RecommendedProductsProps {
  onViewAll: () => void;
}

export function RecommendedProducts({ onViewAll }: RecommendedProductsProps) {
  const products = [
    { id: 1, image: '/images/eyes.jpeg' },
    { id: 2, image: '/images/heels.jpeg' },
    { id: 3, image: '/images/field.jpeg' },
    { id: 4, image: '/images/two white.jpeg' },
    { id: 5, image: '/images/wedding red.jpeg' },
    { id: 6, image: '/images/male female.jpeg' },
  ];

  // Duplicate products for seamless loop
  const duplicatedProducts = [...products, ...products];

  return (
    <section className="bg-black text-white overflow-hidden" style={{ paddingTop: '48px', paddingBottom: '48px', paddingLeft: 0, paddingRight: 0, width: '100%', maxWidth: '100vw' }}>
      <div className="max-w-7xl mx-auto px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-4xl tracking-wider">OUR</h2>
            <h2 className="text-4xl tracking-wider">CULTURE</h2>
          </div>
          <button 
            onClick={onViewAll}
            className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full hover:bg-neutral-200 transition-colors"
          >
            <span className="text-sm tracking-wider">VIEW ALL</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Continuous Scrolling Container */}
        <div className="relative" style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', overflow: 'hidden' }}>
          <style>
            {`
              @keyframes scroll-left {
                0% {
                  transform: translateX(0);
                }
                100% {
                  transform: translateX(-50%);
                }
              }
              .animate-scroll {
                animation: scroll-left 16s linear infinite;
              }
              .animate-scroll:hover {
                animation-play-state: paused;
              }
              .culture-scroll::-webkit-scrollbar {
                display: none;
              }
              .culture-scroll {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}
          </style>
          
          <div
            className="culture-scroll flex animate-scroll"
            style={{
              flexDirection: 'row',
              gap: '8px',
              overflowX: 'auto',
              overflowY: 'hidden',
              width: '100%',
              padding: '0',
              margin: '0',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              minWidth: 'max-content',
            }}
          >
            {duplicatedProducts.map((product, index) => (
              <div key={`${product.id}-${index}`} className="group cursor-pointer" style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                <div
                  style={{
                    overflow: 'hidden',
                    flexShrink: 0,
                    width: '320px',
                    height: '480px',
                    borderRadius: '8px',
                  }}
                >
                  <img
                    src={product.image}
                    alt="Culture image"
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      display: 'block',
                      flexShrink: 0,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
