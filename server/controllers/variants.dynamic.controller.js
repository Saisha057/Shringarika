import { getSupabaseAdmin } from '../config/supabase.js';

// @desc    Get available colors for a product from inventory
// @route   GET /api/products/:productId/colors
// @access  Public
export const getProductColors = async (req, res, next) => {
  try {
    // Route is registered as /:id/colors so the param key is 'id'.
    // Fall back to 'productId' for any legacy route registrations.
    const productId = req.params.id || req.params.productId;

    if (!productId) {
      return res.status(400).json({
        status: 'error',
        message: 'Product ID is required',
      });
    }

    const supabase = getSupabaseAdmin();

    // Get distinct colors from product_inventory
    const { data, error } = await supabase
      .from('product_inventory')
      .select('color')
      .eq('product_id', productId)
      .eq('is_active', true)
      .not('color', 'is', null);

    if (error) {
      console.error('Error fetching product colors:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch colors',
      });
    }

    // Extract unique colors
    const colors = [...new Set(data.map(row => row.color).filter(Boolean))].sort();

    res.status(200).json({
      status: 'success',
      data: {
        productId,
        colors,
        count: colors.length
      },
    });
  } catch (error) {
    console.error('getProductColors error:', error);
    next(error);
  }
};

// @desc    Get available sizes for a product from inventory
// @route   GET /api/products/:productId/sizes
// @access  Public
export const getProductSizes = async (req, res, next) => {
  try {
    const productId = req.params.id || req.params.productId;

    if (!productId) {
      return res.status(400).json({
        status: 'error',
        message: 'Product ID is required',
      });
    }

    const supabase = getSupabaseAdmin();

    // Get distinct sizes from product_inventory
    const { data, error } = await supabase
      .from('product_inventory')
      .select('size')
      .eq('product_id', productId)
      .eq('is_active', true)
      .not('size', 'is', null);

    if (error) {
      console.error('Error fetching product sizes:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch sizes',
      });
    }

    // Extract unique sizes and sort
    const sizeOrder = { 'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6 };
    const sizes = [...new Set(data.map(row => row.size).filter(Boolean))]
      .sort((a, b) => {
        const orderA = sizeOrder[a] || 999;
        const orderB = sizeOrder[b] || 999;
        return orderA - orderB;
      });

    res.status(200).json({
      status: 'success',
      data: {
        productId,
        sizes,
        count: sizes.length
      },
    });
  } catch (error) {
    console.error('getProductSizes error:', error);
    next(error);
  }
};

// @desc    Get product variants (colors + sizes + stock) dynamically
// @route   GET /api/products/:productId/variants
// @access  Public
export const getProductVariants = async (req, res, next) => {
  try {
    const productId = req.params.id || req.params.productId;

    if (!productId) {
      return res.status(400).json({
        status: 'error',
        message: 'Product ID is required',
      });
    }

    const supabase = getSupabaseAdmin();

    // Get all active variants
    const { data: variants, error } = await supabase
      .from('product_inventory')
      .select('id, size, color, stock, low_stock_threshold, is_active')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('size', { ascending: true })
      .order('color', { ascending: true });

    if (error) {
      console.error('Error fetching product variants:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch variants',
      });
    }

    // Also fetch colors stored in product specifications (inventory rows may have null color)
    const { data: productSpec } = await supabase
      .from('products')
      .select('color, specifications')
      .eq('id', productId)
      .single();

    const specColors = Array.isArray(productSpec?.specifications?.colors)
      ? productSpec.specifications.colors
      : [];
    const primaryColor = productSpec?.color ? [productSpec.color] : [];

    // Merge: inventory colors + spec colors + primary color, deduplicated and sorted
    const inventoryColors = [...new Set(variants.map(v => v.color).filter(Boolean))];
    const colors = [...new Set([...inventoryColors, ...specColors, ...primaryColor])].sort();
    
    const sizeOrder = { 'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6 };
    const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))]
      .sort((a, b) => {
        const orderA = sizeOrder[a] || 999;
        const orderB = sizeOrder[b] || 999;
        return orderA - orderB;
      });

    // Build stock map
    const stockMap = {};
    variants.forEach(variant => {
      const size = variant.size;
      const color = variant.color || 'default';
      
      if (!stockMap[size]) {
        stockMap[size] = {};
      }
      
      stockMap[size][color] = {
        stock: variant.stock,
        isLowStock: variant.stock <= (variant.low_stock_threshold || 10),
        variantId: variant.id
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        productId,
        colors,
        sizes,
        stockMap,
        totalVariants: variants.length
      },
    });
  } catch (error) {
    console.error('getProductVariants error:', error);
    next(error);
  }
};
