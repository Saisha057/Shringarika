import { ArrowLeft, Leaf, Users, Recycle, Package, Heart, Target } from 'lucide-react';

interface SustainabilityPageProps {
  onNavigateHome: () => void;
  onNavigateToProducts?: () => void;
}

export function SustainabilityPage({ onNavigateHome, onNavigateToProducts }: SustainabilityPageProps) {
  return (
    <div className="min-h-screen bg-neutral-50 animate-fadeIn">
      {/* Header with Back Button */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-sm tracking-wider hover:underline transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>HOME</span>
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-green-50 to-neutral-100 py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
            <Leaf className="w-8 h-8 text-green-700" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl tracking-widest mb-4 break-words">
            OUR SUSTAINABILITY MISSION
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-neutral-600 max-w-3xl mx-auto leading-relaxed">
            Crafting timeless Indian ethnic wear with respect for our planet, our artisans, and our heritage.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        
        {/* Our Commitment */}
        <section className="mb-16">
          <div className="bg-white rounded-lg p-6 md:p-10 shadow-sm">
            <h2 className="text-2xl md:text-3xl tracking-wider mb-6">Our Commitment to Sustainability</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              At Shringarika, we believe that beauty and responsibility go hand in hand. Every saree, kurti, lehenga, 
              and dupatta we create tells a story—not just of traditional Indian craftsmanship, but of our commitment 
              to preserving the environment and supporting the communities that make our garments possible.
            </p>
            <p className="text-neutral-700 leading-relaxed">
              Our approach to sustainability isn't just a trend; it's woven into the very fabric of our business. 
              From the cotton fields to your wardrobe, we ensure every step of our process honors both tradition and our planet.
            </p>
          </div>
        </section>

        {/* Ethical Fabric Sourcing */}
        <section className="mb-16">
          <div className="bg-white rounded-lg p-6 md:p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Leaf className="w-6 h-6 text-green-700" />
              </div>
              <h2 className="text-2xl md:text-3xl tracking-wider">Ethical Fabric Sourcing</h2>
            </div>
            <p className="text-neutral-700 leading-relaxed mb-4">
              We source only the finest organic and sustainable fabrics for our traditional wear. Our cotton comes from 
              certified organic farms that use no harmful pesticides or chemicals, ensuring the health of both the soil 
              and the farmers who tend it.
            </p>
            <ul className="space-y-2 text-neutral-700">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>100% organic cotton and natural silk</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Handloom fabrics supporting traditional weavers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Natural dyes derived from plants and minerals</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Fair Trade certified suppliers</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Zero-Waste Garment Cutting */}
        <section className="mb-16">
          <div className="bg-white rounded-lg p-6 md:p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Recycle className="w-6 h-6 text-blue-700" />
              </div>
              <h2 className="text-2xl md:text-3xl tracking-wider">Zero-Waste Garment Cutting</h2>
            </div>
            <p className="text-neutral-700 leading-relaxed mb-4">
              Traditional Indian garment construction naturally minimizes waste, and we've taken this principle even 
              further. Our master tailors use advanced pattern-making techniques to ensure maximum fabric utilization.
            </p>
            <ul className="space-y-2 text-neutral-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>95% fabric utilization in saree and lehenga production</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>Leftover fabric scraps repurposed into accessories</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>Fabric remnants donated to craft communities</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>No textile waste sent to landfills</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Handcrafted Not Mass-Produced */}
        <section className="mb-16">
          <div className="bg-amber-50 rounded-lg p-6 md:p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-amber-200 rounded-full flex items-center justify-center">
                <Heart className="w-6 h-6 text-amber-800" />
              </div>
              <h2 className="text-2xl md:text-3xl tracking-wider">Handcrafted, Not Mass-Produced</h2>
            </div>
            <p className="text-neutral-700 leading-relaxed mb-6">
              Every piece at Shringarika is made by skilled artisans who have inherited their craft through generations. 
              We reject fast fashion in favor of slow, intentional creation that honors the time and skill required for 
              authentic Indian ethnic wear.
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-3 tracking-wide">Our Traditional Offerings</h3>
                <ul className="space-y-2 text-neutral-700 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 mt-1">•</span>
                    <span><strong>Sarees:</strong> Hand-woven with intricate borders and pallu designs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 mt-1">•</span>
                    <span><strong>Kurtis:</strong> Block-printed and hand-embroidered detailing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 mt-1">•</span>
                    <span><strong>Lehengas:</strong> Zari work and mirror embellishments</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 mt-1">•</span>
                    <span><strong>Dupattas:</strong> Hand-dyed with traditional bandhani techniques</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 mt-1">•</span>
                    <span><strong>Ethnic Suits:</strong> Tailored with precision and care</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 mt-1">•</span>
                    <span><strong>Handcrafted Fabrics:</strong> Khadi, chanderi, banarasi, and more</span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-3 tracking-wide">Traditional Techniques</h3>
                <ul className="space-y-2 text-neutral-700 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 mt-1">•</span>
                    <span>Hand embroidery (zardozi, chikankari, kasuti)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 mt-1">•</span>
                    <span>Block printing with natural dyes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 mt-1">•</span>
                    <span>Hand-loom weaving on traditional looms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 mt-1">•</span>
                    <span>Tie-and-dye bandhani patterns</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 mt-1">•</span>
                    <span>Hand-painted motifs and borders</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Supporting Local Artisans */}
        <section className="mb-16">
          <div className="bg-white rounded-lg p-6 md:p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-700" />
              </div>
              <h2 className="text-2xl md:text-3xl tracking-wider">Supporting Local Artisans</h2>
            </div>
            <p className="text-neutral-700 leading-relaxed mb-4">
              We partner with over 200 artisan families across India, ensuring fair wages, safe working conditions, 
              and opportunities for skill development. Many of our artisans are women who are the primary breadwinners 
              for their families.
            </p>
            <ul className="space-y-2 text-neutral-700">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">✓</span>
                <span>Fair wages 30% above industry standard</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">✓</span>
                <span>Healthcare and education support for artisan families</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">✓</span>
                <span>Skill training programs for younger generations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">✓</span>
                <span>Direct partnerships eliminating middlemen</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">✓</span>
                <span>Recognition and credit for artisans' work</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Eco-Friendly Packaging */}
        <section className="mb-16">
          <div className="bg-white rounded-lg p-6 md:p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6 text-green-700" />
              </div>
              <h2 className="text-2xl md:text-3xl tracking-wider">Eco-Friendly Packaging</h2>
            </div>
            <p className="text-neutral-700 leading-relaxed mb-6">
              Our commitment to sustainability extends beyond the garment itself. All our packaging is designed to be 
              beautiful, protective, and completely eco-friendly.
            </p>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="text-center p-4">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Recycle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-medium mb-2">Recycled Materials</h3>
                <p className="text-sm text-neutral-600">
                  100% recycled cardboard boxes and tissue paper
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Leaf className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-medium mb-2">Biodegradable</h3>
                <p className="text-sm text-neutral-600">
                  Plant-based packaging tape and compostable mailers
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Package className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-medium mb-2">Reusable Design</h3>
                <p className="text-sm text-neutral-600">
                  Beautiful boxes designed for storage and gifting
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recycling & Upcycling */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-lg p-6 md:p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-teal-200 rounded-full flex items-center justify-center">
                <Recycle className="w-6 h-6 text-teal-800" />
              </div>
              <h2 className="text-2xl md:text-3xl tracking-wider">Recycling & Upcycling Initiatives</h2>
            </div>
            <p className="text-neutral-700 leading-relaxed mb-6">
              We're closing the loop on textile waste through innovative recycling and upcycling programs.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6">
                <h3 className="text-lg font-medium mb-3 tracking-wide">Take-Back Program</h3>
                <p className="text-neutral-700 text-sm mb-3">
                  Return your old Shringarika garments (even worn ones) and receive credit toward your next purchase. 
                  We'll either restore them for resale or upcycle the fabric into new designs.
                </p>
                <ul className="space-y-1 text-neutral-600 text-sm">
                  <li>• 10% store credit for gently used items</li>
                  <li>• 5% credit for well-loved pieces</li>
                  <li>• Free shipping for returns</li>
                </ul>
              </div>
              <div className="bg-white rounded-lg p-6">
                <h3 className="text-lg font-medium mb-3 tracking-wide">Upcycled Collection</h3>
                <p className="text-neutral-700 text-sm mb-3">
                  Our limited-edition upcycled collection transforms vintage sarees and fabric remnants into contemporary 
                  pieces—each one unique and full of history.
                </p>
                <ul className="space-y-1 text-neutral-600 text-sm">
                  <li>• One-of-a-kind statement pieces</li>
                  <li>• Zero new fabric used</li>
                  <li>• Supporting textile preservation</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Future Goals */}
        <section className="mb-12">
          <div className="bg-black text-white rounded-lg p-6 md:p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl md:text-3xl tracking-wider">Future Goals & Innovation</h2>
            </div>
            <p className="text-neutral-300 leading-relaxed mb-6">
              Sustainability is a journey, not a destination. Here's what we're working toward:
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-3 tracking-wide">By 2026</h3>
                <ul className="space-y-2 text-neutral-300 text-sm">
                  <li>• 100% carbon-neutral operations</li>
                  <li>• Solar-powered production facilities</li>
                  <li>• Rainwater harvesting at all locations</li>
                  <li>• Zero plastic in entire supply chain</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-3 tracking-wide">By 2028</h3>
                <ul className="space-y-2 text-neutral-300 text-sm">
                  <li>• Launch artisan scholarship program</li>
                  <li>• Establish textile recycling centers in 10 cities</li>
                  <li>• Partner with 500+ artisan families</li>
                  <li>• Achieve B-Corp certification</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <div className="bg-neutral-100 rounded-lg p-6 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl tracking-wider mb-4">Join Our Sustainable Journey</h2>
          <p className="text-neutral-700 mb-6 max-w-2xl mx-auto">
            Every purchase you make supports ethical craftsmanship, environmental responsibility, and the preservation 
            of traditional Indian textile arts. Together, we can make fashion a force for good.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={onNavigateHome}
              className="px-6 py-3 bg-black text-white tracking-wider hover:bg-neutral-800 transition-colors duration-200"
            >
              BACK TO HOME
            </button>
            <button 
              onClick={onNavigateToProducts}
              className="px-6 py-3 border border-black tracking-wider hover:bg-black hover:text-white transition-colors duration-200"
            >
              SHOP SUSTAINABLE COLLECTION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
