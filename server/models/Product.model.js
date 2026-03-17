import { supabase, supabaseAdmin } from '../config/supabase.js';

export const Product = {
  async findAll() {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async findById(id) {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  async create(productData) {
    console.log('📝 [PRODUCT MODEL] Creating product...');
    
    // Extract variants if provided
    const variants = productData.variants || [];
    const sizes = productData.sizes || [];
    const colors = productData.colors || [];
    
    // Remove variants/sizes/colors from product data (not in products table schema)
    const productDataClean = { ...productData };
    delete productDataClean.variants;
    delete productDataClean.sizes;
    delete productDataClean.colors;
    
    // Insert product first
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .insert([productDataClean])
      .select()
      .single();
    
    if (productError) {
      console.error('❌ [PRODUCT MODEL] Failed to create product:', productError);
      throw productError;
    }

    console.log('✅ [PRODUCT MODEL] Product created with ID:', product.id);

    // Create variants if provided
    let createdVariants = [];
    
    if (variants.length > 0) {
      // Use provided variants
      console.log('📦 [PRODUCT MODEL] Creating', variants.length, 'custom variants...');
      
      const variantsToInsert = variants.map(v => ({
        product_id: product.id,
        size: v.size || null,
        color: v.color || null,
        stock_quantity: v.stock_quantity || v.stockQuantity || 0,
        sku: v.sku || `${product.name}-${v.size || 'OS'}-${v.color || 'NA'}`.toUpperCase().replace(/\s+/g, '-')
      }));

      const { data: insertedVariants, error: variantsError } = await supabaseAdmin
        .from('product_variants')
        .insert(variantsToInsert)
        .select();

      if (variantsError) {
        console.error('❌ [PRODUCT MODEL] Failed to create variants:', variantsError);
        // Don't rollback product, just log warning
        console.warn('⚠️  [PRODUCT MODEL] Product created but variants failed');
      } else {
        createdVariants = insertedVariants || [];
        console.log('✅ [PRODUCT MODEL] Created', createdVariants.length, 'variants');
      }
    } else if (sizes.length > 0 || colors.length > 0) {
      // Generate variants from sizes x colors combinations
      console.log('📦 [PRODUCT MODEL] Generating variants from sizes/colors...');
      
      const sizesToUse = sizes.length > 0 ? sizes : [null];
      const colorsToUse = colors.length > 0 ? colors : [null];
      
      const variantsToInsert = [];
      for (const size of sizesToUse) {
        for (const color of colorsToUse) {
          variantsToInsert.push({
            product_id: product.id,
            size: size,
            color: color,
            stock_quantity: productData.stock || 0,
            sku: `${product.name}-${size || 'OS'}-${color || 'NA'}`.toUpperCase().replace(/\s+/g, '-')
          });
        }
      }

      const { data: insertedVariants, error: variantsError } = await supabaseAdmin
        .from('product_inventory')
        .insert(variantsToInsert)
        .select();

      if (variantsError) {
        console.error('❌ [PRODUCT MODEL] Failed to create variants:', variantsError);
      } else {
        createdVariants = insertedVariants || [];
        console.log('✅ [PRODUCT MODEL] Created', createdVariants.length, 'variants');
      }
    } else {
      // No variants specified - create ONE default variant
      console.log('📦 [PRODUCT MODEL] Creating default variant (no sizes/colors provided)...');
      
      const defaultVariant = {
        product_id: product.id,
        size: null,
        color: null,
        stock_quantity: productData.stock || 0,
        sku: `${product.name}-DEFAULT`.toUpperCase().replace(/\s+/g, '-')
      };

      const { data: insertedVariants, error: variantsError } = await supabaseAdmin
        .from('product_inventory')
        .insert([defaultVariant])
        .select();

      if (variantsError) {
        console.error('❌ [PRODUCT MODEL] Failed to create default variant:', variantsError);
      } else {
        createdVariants = insertedVariants || [];
        console.log('✅ [PRODUCT MODEL] Created default variant');
      }
    }

    // Return product with variants
    return {
      ...product,
      variants: createdVariants
    };
  },
  async update(id, updates) {
    const { data, error } = await supabaseAdmin.from('products').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id) {
    const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
  async findByCategory(category) {
    const { data, error } = await supabase.from('products').select('*').eq('category', category);
    if (error) throw error;
    return data || [];
  }
};
export default Product;
