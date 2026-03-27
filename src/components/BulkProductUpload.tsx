"use client"

import { useState } from "react"
import { Upload, X, Check, AlertCircle, Download } from "lucide-react"
import { useAdmin } from "../context/AdminContext"
import type { Product } from "../data/products"

interface ValidationError {
  row: number
  field: string
  message: string
}

interface ParsedProduct {
  name: string
  price: number
  category: string
  description?: string
  image?: string
  sizes?: string[]
  colors?: string[]
  stock?: number
  rating?: number
  reviews?: number
}

export function BulkProductUpload({ onClose }: { onClose: () => void }) {
  const { products, updateProduct } = useAdmin()
  const [file, setFile] = useState<File | null>(null)
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadComplete, setUploadComplete] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.name.endsWith('.csv') || selectedFile.name.endsWith('.xlsx')) {
        setFile(selectedFile)
        parseFile(selectedFile)
      } else {
        alert('Please select a CSV or Excel file')
      }
    }
  }

  const parseFile = async (file: File) => {
    setIsProcessing(true)
    const text = await file.text()
    const lines = text.split('\n')
    const headers = lines[0].split(',').map(h => h.trim())
    
    const products: ParsedProduct[] = []
    const errors: ValidationError[] = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      
      const values = lines[i].split(',').map(v => v.trim())
      const product: any = {}
      
      headers.forEach((header, index) => {
        product[header.toLowerCase()] = values[index]
      })

      // Validate required fields
      if (!product.name) {
        errors.push({ row: i + 1, field: 'name', message: 'Name is required' })
      }
      if (!product.price || isNaN(Number(product.price))) {
        errors.push({ row: i + 1, field: 'price', message: 'Valid price is required' })
      }
      if (!product.category) {
        errors.push({ row: i + 1, field: 'category', message: 'Category is required' })
      }

      const parsedProduct: ParsedProduct = {
        name: product.name || '',
        price: Number(product.price) || 0,
        category: product.category || '',
        description: product.description || '',
        image: product.image || '',
        sizes: product.sizes ? product.sizes.split('|') : ['M'],
        colors: product.colors ? product.colors.split('|') : [],
        stock: Number(product.stock) || 50,
        rating: Number(product.rating) || 4.5,
        reviews: Number(product.reviews) || 0,
      }

      if (errors.filter(e => e.row === i + 1).length === 0) {
        products.push(parsedProduct)
      }
    }

    setParsedProducts(products)
    setValidationErrors(errors)
    setIsProcessing(false)
  }

  const handleUpload = async () => {
    if (validationErrors.length > 0) {
      alert('Please fix validation errors before uploading')
      return
    }

    setIsProcessing(true)
    const totalProducts = parsedProducts.length
    
    for (let i = 0; i < parsedProducts.length; i++) {
      const parsedProduct = parsedProducts[i]
      
      // Generate unique ID
      const newId =
        Math.max(0, ...products.map(p => Number(p.id) || 0)) + i + 1
      
      const newProduct: Product = {
        id: newId,
        name: parsedProduct.name,
        price: parsedProduct.price,
        category: parsedProduct.category,
        description: parsedProduct.description || '',
        images: parsedProduct.image ? [parsedProduct.image] : [],
        sizes: parsedProduct.sizes || ['M'],
        colors: parsedProduct.colors || [],
        rating: parsedProduct.rating || 4.5,
        reviews: parsedProduct.reviews || 0,
      }

      // Save to localStorage
      const existingProducts = JSON.parse(localStorage.getItem('adminProducts') || '[]')
      existingProducts.push(newProduct)
      localStorage.setItem('adminProducts', JSON.stringify(existingProducts))
      
      // Update progress
      setUploadProgress(Math.round(((i + 1) / totalProducts) * 100))
      
      // Simulate delay for UX
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    setUploadComplete(true)
    setIsProcessing(false)
    
    // Refresh page to show new products
    setTimeout(() => {
      window.location.reload()
    }, 2000)
  }

  const downloadTemplate = () => {
    const template = `name,price,category,description,image,sizes,colors,stock,rating,reviews
Premium Silk Saree,12999,CHANDERI SILK,Elegant silk saree,https://example.com/image.jpg,S|M|L,Red|Blue|Green,100,4.8,45
Designer Kurta,3499,CHANDERI SILK,Beautiful kurta set,https://example.com/image2.jpg,XS|S|M|L|XL,White|Pink,50,4.5,23`
    
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product_upload_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-medium tracking-wider">BULK PRODUCT UPLOAD</h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!uploadComplete ? (
            <>
              {/* Download Template */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900 mb-2">
                  <strong>First time?</strong> Download our CSV template to get started
                </p>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </button>
              </div>

              {/* File Upload */}
              {!file && (
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-12 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-neutral-400" />
                  <p className="text-lg mb-2">Upload CSV or Excel File</p>
                  <p className="text-sm text-neutral-500 mb-4">
                    Maximum file size: 10MB
                  </p>
                  <label className="inline-block px-6 py-3 bg-black text-white rounded cursor-pointer hover:bg-neutral-800 transition-colors">
                    Select File
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Preview */}
              {file && !isProcessing && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-neutral-500">
                        {parsedProducts.length} products found
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFile(null)
                        setParsedProducts([])
                        setValidationErrors([])
                      }}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Validation Errors */}
                  {validationErrors.length > 0 && (
                    <div className="mb-4 p-4 bg-red-50 rounded-lg">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-900">
                            {validationErrors.length} Validation Error(s)
                          </p>
                          <div className="mt-2 space-y-1">
                            {validationErrors.slice(0, 5).map((error, idx) => (
                              <p key={idx} className="text-sm text-red-800">
                                Row {error.row}, {error.field}: {error.message}
                              </p>
                            ))}
                            {validationErrors.length > 5 && (
                              <p className="text-sm text-red-800">
                                ...and {validationErrors.length - 5} more errors
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Product Preview */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-neutral-50 p-3 border-b">
                      <p className="font-medium">Preview</p>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-100 sticky top-0">
                          <tr>
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-left">Price</th>
                            <th className="p-2 text-left">Category</th>
                            <th className="p-2 text-left">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedProducts.slice(0, 10).map((product, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2">{product.name}</td>
                              <td className="p-2">₹{product.price}</td>
                              <td className="p-2">{product.category}</td>
                              <td className="p-2">{product.stock}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsedProducts.length > 10 && (
                        <p className="p-3 text-center text-neutral-500 text-sm">
                          ...and {parsedProducts.length - 10} more products
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Upload Progress */}
                  {isProcessing && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm">Uploading products...</p>
                        <p className="text-sm font-medium">{uploadProgress}%</p>
                      </div>
                      <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-black transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-medium mb-2">Upload Complete!</h3>
              <p className="text-neutral-600">
                Successfully uploaded {parsedProducts.length} products
              </p>
              <p className="text-sm text-neutral-500 mt-2">
                Refreshing page...
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!uploadComplete && file && !isProcessing && (
          <div className="p-6 border-t bg-neutral-50 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-neutral-300 rounded hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={validationErrors.length > 0 || parsedProducts.length === 0}
              className="px-6 py-3 bg-black text-white rounded hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Upload {parsedProducts.length} Products
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
