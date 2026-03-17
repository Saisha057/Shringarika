import { getSupabase } from '../config/supabase.js';

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
export const getUserWishlist = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;

    console.log('🔍 Fetching wishlist for user:', userId);

    // Get wishlist items with product details
    const { data: wishlistItems, error } = await supabase
      .from('wishlist')
      .select(`
        id,
        product_id,
        created_at,
        products (
          id,
          name,
          description,
          price,
          images,
          category,
          total_stock,
          colors,
          sizes
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Get wishlist error:', error);
      // Return empty array instead of 500 error for graceful degradation
      return res.status(200).json({
        status: 'success',
        data: [],
        message: 'Wishlist is empty or could not be loaded',
      });
    }

    // Format response with product data
    const formattedWishlist = (wishlistItems || []).map(item => ({
      id: item.id,
      productId: item.product_id,
      addedAt: item.created_at,
      product: item.products,
    }));

    res.status(200).json({
      status: 'success',
      data: formattedWishlist,
    });
  } catch (error) {
    console.error('❌ Wishlist controller error:', error);
    // Graceful degradation - return empty array
    res.status(200).json({
      status: 'success',
      data: [],
      message: 'Could not load wishlist',
    });
  }
};

// @desc    Add product to wishlist
// @route   POST /api/wishlist/:productId
// @access  Private
export const addToWishlist = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { productId } = req.params;

    // Check if product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    // Check if already in wishlist
    const { data: existing } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    if (existing) {
      return res.status(400).json({
        status: 'error',
        message: 'Product already in wishlist',
      });
    }

    // Add to wishlist
    const { data: wishlistItem, error } = await supabase
      .from('wishlist')
      .insert([
        {
          user_id: userId,
          product_id: productId,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Add to wishlist error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to add to wishlist',
        error: error.message,
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Product added to wishlist',
      data: wishlistItem,
    });
  } catch (error) {
    console.error('Add to wishlist controller error:', error);
    next(error);
  }
};

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
export const removeFromWishlist = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;
    const { productId } = req.params;

    // Delete wishlist item
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) {
      console.error('Remove from wishlist error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to remove from wishlist',
        error: error.message,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Product removed from wishlist',
    });
  } catch (error) {
    console.error('Remove from wishlist controller error:', error);
    next(error);
  }
};

// @desc    Clear entire wishlist
// @route   DELETE /api/wishlist
// @access  Private
export const clearWishlist = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const userId = req.user.id;

    // Delete all wishlist items for user
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Clear wishlist error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to clear wishlist',
        error: error.message,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Wishlist cleared',
    });
  } catch (error) {
    console.error('Clear wishlist controller error:', error);
    next(error);
  }
};
