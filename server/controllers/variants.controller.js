import { getSupabaseAdmin } from '../config/supabase.js';

// Low stock threshold (configurable)
const LOW_STOCK_THRESHOLD = process.env.LOW_STOCK_THRESHOLD || 5;

// @desc    Update a single variant
// @route   PUT /api/products/:productId/variants/:variantId
// @access  Private/Admin
export const updateVariant = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { productId, variantId } = req.params;
    const { size, color, material, sku, stock, price, is_active } = req.body;

    console.log('📝 Updating variant:', variantId, req.body);

    // Validate required fields
    if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
      return res.status(400).json({
        status: 'error',
        message: 'Stock must be a non-negative number',
      });
    }

    // Build update object with only provided fields
    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (size !== undefined) updateData.size = size;
    if (color !== undefined) updateData.color = color;
    if (material !== undefined) updateData.material = material;
    if (sku !== undefined) updateData.sku = sku;
    if (stock !== undefined) updateData.stock = stock;
    if (price !== undefined) updateData.price = price;
    if (is_active !== undefined) updateData.is_active = is_active;

    // Update the variant
    const { data: variant, error } = await supabase
      .from('product_inventory')
      .update(updateData)
      .eq('id', variantId)
      .eq('product_id', productId)
      .select()
      .single();

    if (error) {
      console.error('❌ Update variant error:', error);
      if (error.code === '23505') {
        return res.status(400).json({
          status: 'error',
          message: 'A variant with this combination already exists',
        });
      }
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update variant: ' + error.message,
      });
    }

    if (!variant) {
      return res.status(404).json({
        status: 'error',
        message: 'Variant not found',
      });
    }

    // Check if low stock
    const isLowStock = variant.stock < LOW_STOCK_THRESHOLD;

    console.log('✅ Variant updated:', variant.id, isLowStock ? '⚠️ LOW STOCK' : '');

    res.status(200).json({
      status: 'success',
      data: {
        ...variant,
        isLowStock,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
      },
      message: isLowStock ? 'Variant updated - Low stock alert!' : 'Variant updated successfully',
    });
  } catch (error) {
    console.error('❌ Controller error in updateVariant:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message,
    });
  }
};

// @desc    Delete a variant
// @route   DELETE /api/products/:productId/variants/:variantId
// @access  Private/Admin
export const deleteVariant = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { productId, variantId } = req.params;

    console.log('🗑️ Deleting variant:', variantId);

    const { error } = await supabase
      .from('product_inventory')
      .delete()
      .eq('id', variantId)
      .eq('product_id', productId);

    if (error) {
      console.error('❌ Delete variant error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete variant: ' + error.message,
      });
    }

    console.log('✅ Variant deleted:', variantId);

    res.status(200).json({
      status: 'success',
      message: 'Variant deleted successfully',
    });
  } catch (error) {
    console.error('❌ Controller error in deleteVariant:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message,
    });
  }
};

// @desc    Get variants with low stock alerts
// @route   GET /api/products/:productId/variants/low-stock
// @access  Private/Admin
export const getLowStockVariants = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { productId } = req.params;
    const threshold = req.query.threshold || LOW_STOCK_THRESHOLD;

    console.log('📊 Getting low stock variants for product:', productId, 'threshold:', threshold);

    let query = supabase
      .from('product_inventory')
      .select(`
        *,
        products:product_id (
          id,
          name,
          image
        )
      `)
      .lt('stock', threshold)
      .order('stock', { ascending: true });

    if (productId !== 'all') {
      query = query.eq('product_id', productId);
    }

    const { data: variants, error } = await query;

    if (error) {
      console.error('❌ Get low stock variants error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch low stock variants',
        error: error.message,
      });
    }

    const enrichedVariants = variants.map(v => ({
      ...v,
      isLowStock: true,
      lowStockThreshold: threshold,
    }));

    console.log(`✅ Found ${enrichedVariants.length} low stock variants`);

    res.status(200).json({
      status: 'success',
      data: enrichedVariants,
      count: enrichedVariants.length,
      threshold: parseInt(threshold),
    });
  } catch (error) {
    console.error('❌ Controller error in getLowStockVariants:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message,
    });
  }
};

// @desc    Restock a variant
// @route   POST /api/products/:productId/variants/:variantId/restock
// @access  Private/Admin
export const restockVariant = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { productId, variantId } = req.params;
    const { quantity } = req.body;

    console.log('📦 Restocking variant:', variantId, 'quantity:', quantity);

    // Validate quantity
    if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Quantity must be a positive number',
      });
    }

    // Get current stock
    const { data: variant, error: fetchError } = await supabase
      .from('product_inventory')
      .select('stock')
      .eq('id', variantId)
      .eq('product_id', productId)
      .single();

    if (fetchError || !variant) {
      return res.status(404).json({
        status: 'error',
        message: 'Variant not found',
      });
    }

    // Update stock (add to current)
    const newStock = variant.stock + quantity;

    const { data: updatedVariant, error: updateError } = await supabase
      .from('product_inventory')
      .update({
        stock: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', variantId)
      .eq('product_id', productId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Restock variant error:', updateError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to restock variant: ' + updateError.message,
      });
    }

    const isLowStock = updatedVariant.stock < LOW_STOCK_THRESHOLD;

    console.log(`✅ Variant restocked: ${variant.stock} → ${newStock}`, isLowStock ? '⚠️ Still low stock' : '');

    res.status(200).json({
      status: 'success',
      data: {
        ...updatedVariant,
        isLowStock,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
        previousStock: variant.stock,
        addedQuantity: quantity,
      },
      message: `Added ${quantity} units. New stock: ${newStock}`,
    });
  } catch (error) {
    console.error('❌ Controller error in restockVariant:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message,
    });
  }
};

// @desc    Bulk update variants
// @route   PUT /api/products/:productId/variants/bulk
// @access  Private/Admin
export const bulkUpdateVariants = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { productId } = req.params;
    const { variants } = req.body;

    console.log('🔄 Bulk updating variants for product:', productId);

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Variants array is required',
      });
    }

    // Update each variant
    const results = await Promise.allSettled(
      variants.map(async (variantUpdate) => {
        const { id, size, color, material, sku, stock, price, is_active } = variantUpdate;

        if (!id) {
          throw new Error('Variant ID is required');
        }

        const updateData = {
          updated_at: new Date().toISOString(),
        };

        if (size !== undefined) updateData.size = size;
        if (color !== undefined) updateData.color = color;
        if (material !== undefined) updateData.material = material;
        if (sku !== undefined) updateData.sku = sku;
        if (stock !== undefined) updateData.stock = stock;
        if (price !== undefined) updateData.price = price;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabase
          .from('product_inventory')
          .update(updateData)
          .eq('id', id)
          .eq('product_id', productId)
          .select()
          .single();

        if (error) throw error;
        return data;
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);

    console.log(`✅ Bulk update complete: ${successful.length} success, ${failed.length} failed`);

    res.status(200).json({
      status: 'success',
      data: {
        successful,
        failed: failed.map(e => e.message),
        successCount: successful.length,
        failCount: failed.length,
      },
      message: `Updated ${successful.length} of ${variants.length} variants`,
    });
  } catch (error) {
    console.error('❌ Controller error in bulkUpdateVariants:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message,
    });
  }
};

// @desc    Get variant statistics
// @route   GET /api/products/:productId/variants/stats
// @access  Private/Admin
export const getVariantStats = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { productId } = req.params;

    console.log('📊 Getting variant stats for product:', productId);

    let query = supabase
      .from('product_inventory')
      .select('stock, is_active');

    if (productId !== 'all') {
      query = query.eq('product_id', productId);
    }

    const { data: variants, error } = await query;

    if (error) {
      console.error('❌ Get variant stats error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch variant stats',
        error: error.message,
      });
    }

    const stats = {
      total: variants.length,
      active: variants.filter(v => v.is_active !== false).length,
      inactive: variants.filter(v => v.is_active === false).length,
      lowStock: variants.filter(v => v.stock < LOW_STOCK_THRESHOLD).length,
      outOfStock: variants.filter(v => v.stock === 0).length,
      totalStock: variants.reduce((sum, v) => sum + (v.stock || 0), 0),
      averageStock: variants.length > 0 ? Math.round(variants.reduce((sum, v) => sum + (v.stock || 0), 0) / variants.length) : 0,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    };

    console.log('✅ Variant stats calculated:', stats);

    res.status(200).json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    console.error('❌ Controller error in getVariantStats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message,
    });
  }
};
