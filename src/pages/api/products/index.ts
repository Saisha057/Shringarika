/**
 * API ROUTE: /api/products
 * 
 * Handles product CRUD operations
 * - GET: Returns all products
 * - POST: Creates a new product
 * 
 * DATA FLOW:
 * 1. AdminProductForm → POST /api/products → Save to localStorage
 * 2. Product pages → GET /api/products → Display products
 * 
 * FIX: New products are APPENDED, not replacing entire array
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import type { Product } from '../../../data/products'

// Simple in-memory storage (in production, use database)
// Using localStorage equivalent for Node.js
let productsData: Product[] = []

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // GET /api/products - Return all products
    // Load from file system or return from memory
    res.status(200).json({ products: productsData })
  } 
  else if (req.method === 'POST') {
    // POST /api/products - Create new product
    try {
      const newProduct: Product = req.body
      
      // FIX: APPEND to existing products, don't replace
      productsData = [...productsData, newProduct]
      
      console.log('✅ Product created:', newProduct.name, '| Total products:', productsData.length)
      
      res.status(201).json({ 
        success: true, 
        product: newProduct,
        totalProducts: productsData.length 
      })
    } catch (error) {
      console.error('❌ Error creating product:', error)
      res.status(500).json({ error: 'Failed to create product' })
    }
  }
  else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
