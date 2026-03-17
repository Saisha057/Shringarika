"use client"

import { useState } from "react"
import { Barcode, Download, Printer, Camera, X } from "lucide-react"
import JsBarcode from "jsbarcode"

interface BarcodeGeneratorProps {
  onClose: () => void
}

export function BarcodeGenerator({ onClose }: BarcodeGeneratorProps) {
  const [barcodeType, setBarcodeType] = useState<'CODE128' | 'EAN13' | 'CODE39' | 'ITF14'>('CODE128')
  const [sku, setSku] = useState('')
  const [productName, setProductName] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [generatedBarcodes, setGeneratedBarcodes] = useState<{ sku: string; svg: string; productName: string; price: string }[]>([])
  const [scanning, setScanning] = useState(false)

  const generateBarcode = () => {
    if (!sku) {
      alert('Please enter a SKU')
      return
    }

    try {
      // Validate and format based on barcode type
      let formattedSku = sku
      if (barcodeType === 'EAN13') {
        // EAN-13 must be exactly 12 digits (13th is check digit)
        formattedSku = sku.replace(/\D/g, '').padStart(12, '0').substring(0, 12)
      } else if (barcodeType === 'ITF14') {
        // ITF-14 must be exactly 14 digits
        formattedSku = sku.replace(/\D/g, '').padStart(14, '0').substring(0, 14)
      }

      const barcodes = []
      for (let i = 0; i < quantity; i++) {
        const canvas = document.createElement('canvas')
        JsBarcode(canvas, formattedSku, {
          format: barcodeType,
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 14,
          margin: 10,
        })
        barcodes.push({
          sku: formattedSku,
          svg: canvas.toDataURL('image/png'),
          productName,
          price,
        })
      }

      setGeneratedBarcodes([...generatedBarcodes, ...barcodes])
    } catch (error) {
      alert(`Error generating barcode: ${error instanceof Error ? error.message : 'Invalid format'}`)
    }
  }

  const downloadBarcode = (barcode: string, sku: string) => {
    const link = document.createElement('a')
    link.href = barcode
    link.download = `barcode-${sku}-${Date.now()}.png`
    link.click()
  }

  const downloadAllBarcodes = () => {
    generatedBarcodes.forEach((barcode, index) => {
      setTimeout(() => {
        downloadBarcode(barcode.svg, `${barcode.sku}-${index}`)
      }, index * 100)
    })
  }

  const printBarcodes = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcodes</title>
        <style>
          body { 
            margin: 0; 
            padding: 20px; 
            font-family: Arial, sans-serif;
          }
          .barcode-label {
            display: inline-block;
            width: 2.5in;
            height: 1.5in;
            border: 1px dashed #ccc;
            padding: 10px;
            margin: 5px;
            text-align: center;
            page-break-inside: avoid;
          }
          .barcode-label img {
            max-width: 100%;
            height: auto;
          }
          .product-name {
            font-size: 10px;
            font-weight: bold;
            margin: 5px 0;
          }
          .price {
            font-size: 12px;
            font-weight: bold;
          }
          @media print {
            body { padding: 0; }
            .barcode-label { border: none; }
          }
        </style>
      </head>
      <body>
        ${generatedBarcodes.map(barcode => `
          <div class="barcode-label">
            <div class="product-name">${barcode.productName || 'Product'}</div>
            <img src="${barcode.svg}" alt="Barcode ${barcode.sku}" />
            ${barcode.price ? `<div class="price">₹${barcode.price}</div>` : ''}
          </div>
        `).join('')}
        <script>
          window.onload = () => {
            window.print();
            window.onafterprint = () => window.close();
          };
        </script>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  const clearAll = () => {
    setGeneratedBarcodes([])
  }

  const scanBarcode = () => {
    setScanning(true)
    // In a real implementation, this would use the camera API
    // For now, we'll show a placeholder
    setTimeout(() => {
      alert('Camera-based barcode scanning requires additional setup.\nPlease use a dedicated barcode scanner or manual entry.')
      setScanning(false)
    }, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-1">Barcode Generator</h2>
              <p className="text-neutral-600">Generate and print product barcodes</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Generation Form */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Generate New Barcode</h3>

              <div>
                <label className="block text-sm font-medium mb-1">Barcode Type</label>
                <select
                  value={barcodeType}
                  onChange={(e) => setBarcodeType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="CODE128">CODE128 (Alphanumeric)</option>
                  <option value="EAN13">EAN-13 (13 digits)</option>
                  <option value="CODE39">CODE39 (Alphanumeric)</option>
                  <option value="ITF14">ITF-14 (14 digits)</option>
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  {barcodeType === 'EAN13' && 'Used for retail products (12-13 digits)'}
                  {barcodeType === 'CODE128' && 'Most versatile, supports letters & numbers'}
                  {barcodeType === 'CODE39' && 'Common in non-retail industries'}
                  {barcodeType === 'ITF14' && 'Used for shipping containers (14 digits)'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">SKU / Product Code *</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder={
                    barcodeType === 'EAN13' ? '123456789012' :
                    barcodeType === 'ITF14' ? '12345678901234' :
                    'SKU-001-RED-M'
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Product Name (optional)</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Silk Saree - Red"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Price (optional)</label>
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="2999"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                  min="1"
                  max="100"
                />
              </div>

              <button
                onClick={generateBarcode}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded hover:bg-neutral-800"
              >
                <Barcode className="h-5 w-5" />
                Generate Barcode
              </button>

              <div className="pt-4 border-t">
                <button
                  onClick={scanBarcode}
                  disabled={scanning}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded hover:bg-neutral-50 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                  {scanning ? 'Scanning...' : 'Scan Existing Barcode'}
                </button>
              </div>
            </div>

            {/* Generated Barcodes */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Generated Barcodes ({generatedBarcodes.length})</h3>
                {generatedBarcodes.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={downloadAllBarcodes}
                      className="flex items-center gap-1 px-3 py-1 text-sm border rounded hover:bg-neutral-50"
                      title="Download All"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={printBarcodes}
                      className="flex items-center gap-1 px-3 py-1 text-sm border rounded hover:bg-neutral-50"
                      title="Print All"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={clearAll}
                      className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {generatedBarcodes.length === 0 ? (
                  <div className="text-center py-12 text-neutral-500">
                    <Barcode className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No barcodes generated yet</p>
                    <p className="text-sm mt-1">Fill in the form and click generate</p>
                  </div>
                ) : (
                  generatedBarcodes.map((barcode, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-white">
                      {barcode.productName && (
                        <p className="font-medium text-sm mb-2">{barcode.productName}</p>
                      )}
                      <img src={barcode.svg} alt={`Barcode ${barcode.sku}`} className="w-full mb-2" />
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-neutral-500">SKU: {barcode.sku}</p>
                          {barcode.price && (
                            <p className="text-sm font-bold">₹{barcode.price}</p>
                          )}
                        </div>
                        <button
                          onClick={() => downloadBarcode(barcode.svg, barcode.sku)}
                          className="p-2 hover:bg-neutral-100 rounded"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-neutral-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-neutral-600">
              💡 Tip: Use CODE128 for most products. EAN-13 for retail items.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 border rounded hover:bg-neutral-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
