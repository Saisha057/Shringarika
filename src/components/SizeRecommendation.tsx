"use client"

import { useState } from "react"
import { X, Ruler, User, Info } from "lucide-react"

interface SizeRecommendationProps {
  productCategory: string
  onClose: () => void
  onSizeSelect: (size: string) => void
}

interface MeasurementData {
  height: string
  weight: string
  chest?: string
  waist?: string
  hips?: string
}

const sizeCharts = {
  'CHANDERI SILK': {
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    measurements: {
      'XS': { bust: '32-34', waist: '24-26', hips: '34-36', height: '5.0-5.3' },
      'S': { bust: '34-36', waist: '26-28', hips: '36-38', height: '5.2-5.5' },
      'M': { bust: '36-38', waist: '28-30', hips: '38-40', height: '5.4-5.7' },
      'L': { bust: '38-40', waist: '30-32', hips: '40-42', height: '5.6-5.9' },
      'XL': { bust: '40-42', waist: '32-34', hips: '42-44', height: '5.8-6.0' },
      'XXL': { bust: '42-44', waist: '34-36', hips: '44-46', height: '5.9-6.1' },
    }
  },
  'LONG KURTI': {
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    measurements: {
      'XS': { bust: '32-34', waist: '24-26', length: '44', height: '5.0-5.3' },
      'S': { bust: '34-36', waist: '26-28', length: '45', height: '5.2-5.5' },
      'M': { bust: '36-38', waist: '28-30', length: '46', height: '5.4-5.7' },
      'L': { bust: '38-40', waist: '30-32', length: '47', height: '5.6-5.9' },
      'XL': { bust: '40-42', waist: '32-34', length: '48', height: '5.8-6.0' },
      'XXL': { bust: '42-44', waist: '34-36', length: '49', height: '5.9-6.1' },
    }
  },
  'NAAYRA CUT': {
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    measurements: {
      'XS': { bust: '32-34', waist: '24-26', hips: '34-36', height: '5.0-5.3' },
      'S': { bust: '34-36', waist: '26-28', hips: '36-38', height: '5.2-5.5' },
      'M': { bust: '36-38', waist: '28-30', hips: '38-40', height: '5.4-5.7' },
      'L': { bust: '38-40', waist: '30-32', hips: '40-42', height: '5.6-5.9' },
      'XL': { bust: '40-42', waist: '32-34', hips: '42-44', height: '5.8-6.0' },
      'XXL': { bust: '42-44', waist: '34-36', hips: '44-46', height: '5.9-6.1' },
    }
  },
}

export function SizeRecommendation({ productCategory, onClose, onSizeSelect }: SizeRecommendationProps) {
  const [step, setStep] = useState<'input' | 'result'>('input')
  const [measurements, setMeasurements] = useState<MeasurementData>({
    height: '',
    weight: '',
    chest: '',
    waist: '',
    hips: '',
  })
  const [recommendedSize, setRecommendedSize] = useState<string>('')
  const [fitType, setFitType] = useState<'Regular' | 'Relaxed' | 'Fitted'>('Regular')

  const getSizeChart = () => {
    const normalizedCategory = productCategory.toUpperCase()
    if (normalizedCategory.includes('CHANDERI') || normalizedCategory.includes('SILK')) {
      return sizeCharts['CHANDERI SILK']
    } else if (normalizedCategory.includes('KURTI')) {
      return sizeCharts['LONG KURTI']
    } else {
      return sizeCharts['NAAYRA CUT']
    }
  }

  const calculateSize = () => {
    const chart = getSizeChart()
    const heightFeet = parseFloat(measurements.height)
    const chestInches = parseFloat(measurements.chest || '0')
    const waistInches = parseFloat(measurements.waist || '0')

    if (!heightFeet && !chestInches) {
      alert('Please enter at least height or chest measurement')
      return
    }

    // AI-like size recommendation logic
    let recommendedSizeIndex = 2 // Default to M

    // Factor in height
    if (heightFeet > 0) {
      if (heightFeet < 5.2) recommendedSizeIndex = 0 // XS
      else if (heightFeet < 5.4) recommendedSizeIndex = 1 // S
      else if (heightFeet < 5.6) recommendedSizeIndex = 2 // M
      else if (heightFeet < 5.8) recommendedSizeIndex = 3 // L
      else if (heightFeet < 6.0) recommendedSizeIndex = 4 // XL
      else recommendedSizeIndex = 5 // XXL
    }

    // Adjust based on chest measurement
    if (chestInches > 0) {
      if (chestInches < 34) recommendedSizeIndex = Math.min(recommendedSizeIndex, 0)
      else if (chestInches < 36) recommendedSizeIndex = Math.min(recommendedSizeIndex, 1)
      else if (chestInches < 38) recommendedSizeIndex = Math.min(recommendedSizeIndex, 2)
      else if (chestInches < 40) recommendedSizeIndex = Math.max(recommendedSizeIndex, 3)
      else if (chestInches < 42) recommendedSizeIndex = Math.max(recommendedSizeIndex, 4)
      else recommendedSizeIndex = Math.max(recommendedSizeIndex, 5)
    }

    // Adjust for fit preference
    if (fitType === 'Relaxed' && recommendedSizeIndex < 5) {
      recommendedSizeIndex += 1
    } else if (fitType === 'Fitted' && recommendedSizeIndex > 0) {
      recommendedSizeIndex -= 1
    }

    const size = chart.sizes[recommendedSizeIndex]
    setRecommendedSize(size)
    setStep('result')
  }

  const handleInputChange = (field: keyof MeasurementData, value: string) => {
    setMeasurements(prev => ({ ...prev, [field]: value }))
  }

  const chart = getSizeChart()

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            <h2 className="text-xl font-medium">Size Recommendation</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'input' ? (
          <div className="p-6 space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Get your perfect size!</p>
                <p>Enter your measurements and we'll recommend the best size for you using our AI-powered size guide.</p>
              </div>
            </div>

            {/* Fit Preference */}
            <div>
              <label className="block text-sm font-medium mb-3">How would you like it to fit?</label>
              <div className="grid grid-cols-3 gap-3">
                {(['Fitted', 'Regular', 'Relaxed'] as const).map((fit) => (
                  <button
                    key={fit}
                    onClick={() => setFitType(fit)}
                    className={`py-3 px-4 rounded border-2 transition-all ${
                      fitType === fit
                        ? 'border-black bg-black text-white'
                        : 'border-neutral-300 hover:border-neutral-400'
                    }`}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>

            {/* Measurements Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Height (feet)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="5.5"
                    value={measurements.height}
                    onChange={(e) => handleInputChange('height', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Example: 5.5 for 5'6"</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Weight (kg)</label>
                  <input
                    type="number"
                    placeholder="55"
                    value={measurements.weight}
                    onChange={(e) => handleInputChange('weight', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Bust (inches)</label>
                  <input
                    type="number"
                    placeholder="36"
                    value={measurements.chest}
                    onChange={(e) => handleInputChange('chest', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Waist (inches)</label>
                  <input
                    type="number"
                    placeholder="28"
                    value={measurements.waist}
                    onChange={(e) => handleInputChange('waist', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Hips (inches)</label>
                  <input
                    type="number"
                    placeholder="38"
                    value={measurements.hips}
                    onChange={(e) => handleInputChange('hips', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>
            </div>

            {/* Size Chart Reference */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-3 text-sm">Size Chart Reference</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4">Size</th>
                      <th className="text-left py-2 pr-4">Bust</th>
                      <th className="text-left py-2 pr-4">Waist</th>
                      <th className="text-left py-2 pr-4">Height</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.sizes.map((size) => {
                      const measure = chart.measurements[size as keyof typeof chart.measurements]
                      return (
                        <tr key={size} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{size}</td>
                          <td className="py-2 pr-4">{measure.bust}"</td>
                          <td className="py-2 pr-4">{measure.waist}"</td>
                          <td className="py-2 pr-4">{measure.height}'</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={calculateSize}
              className="w-full py-3 bg-black text-white rounded hover:bg-neutral-800 transition-colors font-medium"
            >
              Get Size Recommendation
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Result */}
            <div className="text-center py-8 bg-green-50 rounded-lg">
              <User className="h-16 w-16 mx-auto mb-4 text-green-600" />
              <h3 className="text-2xl font-medium mb-2">Your Recommended Size</h3>
              <div className="text-6xl font-bold text-green-600 mb-4">{recommendedSize}</div>
              <p className="text-neutral-600">Based on your measurements and {fitType.toLowerCase()} fit preference</p>
            </div>

            {/* Size Details */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">Size {recommendedSize} Details</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(chart.measurements[recommendedSize as keyof typeof chart.measurements]).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b">
                    <span className="text-neutral-600 capitalize">{key}:</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-900 font-medium mb-2">💡 Sizing Tips:</p>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• If between sizes, we recommend sizing up for comfort</li>
                <li>• Consider the fabric - silk has less stretch than cotton</li>
                <li>• Check the product description for specific fit details</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('input')}
                className="flex-1 py-3 border-2 border-neutral-300 rounded hover:bg-neutral-50 transition-colors font-medium"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  onSizeSelect(recommendedSize)
                  onClose()
                }}
                className="flex-1 py-3 bg-black text-white rounded hover:bg-neutral-800 transition-colors font-medium"
              >
                Select Size {recommendedSize}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
