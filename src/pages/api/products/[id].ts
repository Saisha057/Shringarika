/**
 * API ROUTE: /api/products/[id]
 * 
 * Handles single product operations
 * - GET: Returns product by ID
 * - PUT: Updates existing product
 * - DELETE: Deletes product
 * 
 * FIX: Updates are properly merged, not replacing entire product
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import type { Product } from '../../../data/products'

// Shared data store (in production, use database)
let productsData: Product[] = []

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const productId = typeof id === 'string' ? parseInt(id) : 0

  if (req.method === 'GET') {
    // GET /api/products/:id - Return single product
    const product = productsData.find((p) => p.id === productId)
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    
    res.status(200).json({ product })
  } 
  else if (req.method === 'PUT') {
    // PUT /api/products/:id - Update product
    try {
      const updates: Partial<Product> = req.body
      
      // FIX: Merge updates with existing product data
      productsData = productsData.map((p) =>
        p.id === productId ? { ...p, ...updates } : p
      )
      
      const updatedProduct = productsData.find((p) => p.id === productId)
      
      if (!updatedProduct) {
        return res.status(404).json({ error: 'Product not found' })
      }
      
      console.log('✅ Product updated:', updatedProduct.name)
      
      res.status(200).json({ 
        success: true, 
        product: updatedProduct 
      })
    } catch (error) {
      console.error('❌ Error updating product:', error)
      res.status(500).json({ error: 'Failed to update product' })
    }
  }
  else if (req.method === 'DELETE') {
    // DELETE /api/products/:id - Delete product
    try {
      productsData = productsData.filter((p) => p.id !== productId)
      
      console.log('✅ Product deleted:', productId)
      
      res.status(200).json({ success: true })
    } catch (error) {
      console.error('❌ Error deleting product:', error)
      res.status(500).json({ error: 'Failed to delete product' })
    }
  }
  else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
