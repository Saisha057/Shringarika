import { getSupabaseAdmin } from '../config/supabase.js';

// UUID validation helper — prevents PostgreSQL crash on invalid uuid syntax
const isValidUUID = (id) => {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
};

/**
 * AUTO-GENERATE VARIANTS CONTROLLER
 * Creates multiple variants at once with specified sizes and colors
 */

// @desc    Auto-generate variants for a product
// @route   POST /api/products/:id/variants/auto-generate
// @access  Private/Admin
export const autoGenerateVariants = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { sizes, colors, materials, defaultStock } = req.body;

    console.log('🎨 Auto-generating variants for product:', productId);
    console.log('📊 Sizes:', sizes);
    console.log('🌈 Colors:', colors);
    console.log('🧵 Materials:', materials);
    console.log('📦 Default stock:', defaultStock);

    // Guard: legacy numeric/timestamp IDs cannot match UUID column
    if (!isValidUUID(productId)) {
      console.warn(`⚠️ autoGenerateVariants: non-UUID product ID: ${productId}`);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid product ID format. This product uses a legacy ID and cannot have variants. Please recreate the product.'
      });
    }

    // Validation
    if (!sizes || !Array.isArray(sizes) || sizes.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Sizes array is required and must not be empty'
      });
    }

    const supabase = getSupabaseAdmin();

    // Check if product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    const variantsToCreate = [];
    const stockValue = typeof defaultStock === 'number' ? defaultStock : 50;
    const materialList = materials && Array.isArray(materials) && materials.length > 0 ? materials : [null];

    // Generate size × color × material combinations
    if (colors && Array.isArray(colors) && colors.length > 0) {
      for (const size of sizes) {
        for (const color of colors) {
          for (const material of materialList) {
            const skuBase = `${product.name.replace(/\s+/g, '-').toUpperCase()}-${size}-${color}`;
            const sku = (material ? `${skuBase}-${material}` : skuBase).substring(0, 50);
            variantsToCreate.push({
              product_id: productId,
              size: size.trim(),
              color: color.trim(),
              material: material ? material.trim() : null,
              sku,
              stock: stockValue,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
      }
    } else {
      // No colors — create size × material variants
      for (const size of sizes) {
        for (const material of materialList) {
          const skuBase = `${product.name.replace(/\s+/g, '-').toUpperCase()}-${size}`;
          const sku = (material ? `${skuBase}-${material}` : skuBase).substring(0, 50);
          variantsToCreate.push({
            product_id: productId,
            size: size.trim(),
            color: null,
            material: material ? material.trim() : null,
            sku,
            stock: stockValue,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    console.log(`📝 Creating ${variantsToCreate.length} variants...`);

    // Check for existing variants to avoid duplicates
    const { data: existingVariants, error: checkError } = await supabase
      .from('product_inventory')
      .select('size, color, material')
      .eq('product_id', productId);

    if (checkError) {
      console.error('❌ Error checking existing variants:', checkError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to check existing variants',
        error: checkError.message
      });
    }

    // Filter out duplicates — key includes material so Silk and Cotton are distinct rows
    const existingSet = new Set(
      existingVariants.map(v => `${v.size}|${v.color || ''}|${v.material || ''}`)
    );

    const newVariants = variantsToCreate.filter(v =>
      !existingSet.has(`${v.size}|${v.color || ''}|${v.material || ''}`)
    );

    if (newVariants.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'All variants already exist',
        data: {
          created: 0,
          skipped: variantsToCreate.length,
          variants: existingVariants
        }
      });
    }

    console.log(`✅ ${newVariants.length} new variants to create (${variantsToCreate.length - newVariants.length} duplicates skipped)`);

    // Insert new variants
    const { data: createdVariants, error: insertError } = await supabase
      .from('product_inventory')
      .insert(newVariants)
      .select();

    if (insertError) {
      console.error('❌ Error creating variants:', insertError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create variants',
        error: insertError.message
      });
    }

    console.log(`✅ Successfully created ${createdVariants.length} variants`);

    // Return all variants for this product
    const { data: allVariants, error: fetchError } = await supabase
      .from('product_inventory')
      .select('*')
      .eq('product_id', productId)
      .order('size', { ascending: true });

    if (fetchError) {
      console.warn('⚠️ Error fetching all variants:', fetchError);
    }

    res.status(201).json({
      status: 'success',
      message: `Created ${createdVariants.length} variants`,
      data: {
        created: createdVariants.length,
        skipped: variantsToCreate.length - newVariants.length,
        variants: allVariants || createdVariants
      }
    });
  } catch (error) {
    console.error('❌ Auto-generate variants error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to auto-generate variants',
      error: error.message
    });
  }
};

// @desc    Add a single variant
// @route   POST /api/products/:id/variants/single
// @access  Private/Admin
export const addSingleVariant = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { size, color, sku, stock, material, price_modifier } = req.body;

    console.log('➕ Adding single variant for product:', productId);
    console.log('📊 Variant data:', { size, color, sku, stock, material, price_modifier });

    // Guard: legacy numeric/timestamp IDs cannot match UUID column
    if (!isValidUUID(productId)) {
      console.warn(`⚠️ addSingleVariant: non-UUID product ID: ${productId}`);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid product ID format. This product uses a legacy ID and cannot have variants. Please recreate the product.'
      });
    }

    // Validation
    if (!size || !size.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Size is required'
      });
    }

    const supabase = getSupabaseAdmin();

    // Check if product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    // Check for duplicate
    const { data: existing, error: checkError } = await supabase
      .from('product_inventory')
      .select('id')
      .eq('product_id', productId)
      .eq('size', size.trim())
      .eq('color', color?.trim() || null)
      .single();

    if (existing) {
      return res.status(400).json({
        status: 'error',
        message: `Variant with size "${size}" and color "${color || 'none'}" already exists`
      });
    }

    // Create variant
    const variantData = {
      product_id: productId,
      size: size.trim(),
      color: color?.trim() || null,
      material: material?.trim() || null,
      price_modifier: typeof price_modifier === 'number' ? price_modifier : 0,
      sku: sku || `${product.name.replace(/\s+/g, '-').toUpperCase()}-${size}${color ? '-' + color : ''}`.substring(0, 50),
      stock: typeof stock === 'number' ? stock : 50,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: createdVariant, error: insertError } = await supabase
      .from('product_inventory')
      .insert(variantData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creating variant:', insertError);
      
      if (insertError.code === '23505') {
        return res.status(400).json({
          status: 'error',
          message: 'Variant with this size and color combination already exists'
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create variant',
        error: insertError.message
      });
    }

    console.log('✅ Variant created successfully:', createdVariant.id);

    res.status(201).json({
      status: 'success',
      message: 'Variant created successfully',
      data: createdVariant
    });
  } catch (error) {
    console.error('❌ Add single variant error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add variant',
      error: error.message
    });
  }
};
