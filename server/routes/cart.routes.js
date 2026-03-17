import express from 'express';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// In-memory cart storage (replace with database later)
const carts = new Map();

// Get user's cart
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = carts.get(userId) || { items: [], total: 0 };
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cart', error: error.message });
  }
});

// Add item to cart
router.post('/add', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity, size, color, name, price, image } = req.body;

    let cart = carts.get(userId) || { items: [], total: 0 };

    // Check if item already exists
    const existingItemIndex = cart.items.findIndex(
      item => item.productId === productId && item.size === size && item.color === color
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      cart.items.push({
        id: Date.now().toString(),
        productId,
        name,
        price,
        image,
        quantity,
        size,
        color,
      });
    }

    // Calculate total
    cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    carts.set(userId, cart);
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Error adding to cart', error: error.message });
  }
});

// Update cart item quantity
router.put('/:itemId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    let cart = carts.get(userId);
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    carts.set(userId, cart);
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Error updating cart', error: error.message });
  }
});

// Remove item from cart
router.delete('/:itemId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    let cart = carts.get(userId);
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.id !== itemId);

    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    carts.set(userId, cart);
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Error removing from cart', error: error.message });
  }
});

// Clear cart
router.delete('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    carts.delete(userId);
    res.json({ message: 'Cart cleared', items: [], total: 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing cart', error: error.message });
  }
});

// Sync local cart with server
router.post('/sync', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items } = req.body;

    const cart = {
      items: items || [],
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    };

    carts.set(userId, cart);
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Error syncing cart', error: error.message });
  }
});

export default router;
