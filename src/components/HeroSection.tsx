"use client"

import { useState } from "react"

interface HeroSectionProps {
  onViewShowroom: () => void
}

export function HeroSection({ onViewShowroom }: HeroSectionProps) {
  const [selectedSize, setSelectedSize] = useState("M")

  return (
    <section className="bg-neutral-200 px-3 sm:px-4 md:px-8 py-6 md:py-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-center">
          {/* Left Content */}
          <div className="md:col-span-4 space-y-4 md:space-y-8">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl tracking-wide mb-1 md:mb-2">SHRINGARIKA —</h2>
              <h3 className="text-xl sm:text-2xl md:text-3xl tracking-wide">TRADITIONAL</h3>
              <h3 className="text-xl sm:text-2xl md:text-3xl tracking-wide">WEAR</h3>
            </div>

            {/* Size Selector */}
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 text-xs md:text-sm">
                <span>SIZE:</span>
                <span>{selectedSize}</span>
              </div>
              <div className="flex gap-2">
                {["XS", "S", "M", "L", "XL"].map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`w-8 h-8 md:w-10 md:h-10 border border-black flex items-center justify-center text-xs md:text-sm transition-colors rounded ${
                      selectedSize === size ? "bg-black text-white" : "hover:bg-black hover:text-white"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
              <button
                onClick={onViewShowroom}
                className="border border-black px-4 md:px-8 py-2 md:py-3 rounded-full text-xs md:text-sm tracking-wider hover:bg-black hover:text-white transition-colors"
              >
                VIEW IN SHOWROOM
              </button>
            </div>
          </div>

          {/* Center and Right - Product Images */}
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {/* Main Image */}
            <div className="sm:col-span-1">
              <div className="aspect-[3/4] relative bg-neutral-300 border border-neutral-400 rounded overflow-hidden">
                <img
                  src="/images/pink and blue saree.jpeg"
                  alt="Pink and blue traditional saree"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Secondary Image */}
            <div className="sm:col-span-1">
              <div className="aspect-[3/4] relative bg-neutral-300 border border-neutral-400 rounded overflow-hidden">
                <img 
                  src="/images/royal red.jpeg" 
                  alt="Royal red lehenga" 
                  className="absolute inset-0 w-full h-full object-cover" 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
