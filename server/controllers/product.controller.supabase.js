import { getSupabase, getSupabaseAdmin } from '../config/supabase.js';
import { sendAdminNotification } from '../services/notification.service.js';
import { logOrderEvent } from '../services/orderEvent.service.js';
import { createAdminNotification } from '../services/adminNotification.service.js';

// ── UUID validation helper ────────────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id) => UUID_REGEX.test(String(id));

// Strip base64 data-URLs from an images array – only real URLs are stored in DB
const cleanImageArray = (images) => {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img) => typeof img === 'string' && img.trim())
    .map((img) => {
      if (img.startsWith('data:') || img.startsWith('blob:')) return null; // discard base64/blob
      return img;
    })
    .filter(Boolean);
};
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Search products with advanced filters
// @route   GET /api/products/search
// @access  Public
export const searchProducts = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const {
      q, // search query
      category,
      minPrice,
      maxPrice,
      inStock,
      sortBy = 'relevance',
      page = 1,
      limit = 50,
    } = req.query;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    // Full-text search across multiple fields
    if (q && q.trim()) {
      const searchTerm = q.trim();
      // Use OR conditions for multiple fields
      query = query.or(
        `name.ilike.%${searchTerm}%,` +
        `description.ilike.%${searchTerm}%,` +
        `category.ilike.%${searchTerm}%,` +
        `color.ilike.%${searchTerm}%`
      );
    }

    // Category filter
    if (category && category !== 'ALL') {
      query = query.ilike('category', `%${category}%`);
    }

    // Price range filter
    if (minPrice) {
      query = query.gte('price', Number(minPrice));
    }
    if (maxPrice) {
      query = query.lte('price', Number(maxPrice));
    }

    // Stock filter
    if (inStock === 'true') {
      query = query.gt('stock', 0);
    }

    // Sorting
    let orderColumn = 'created_at';
    let orderAscending = false;

    switch (sortBy) {
      case 'price-low':
        orderColumn = 'price';
        orderAscending = true;
        break;
      case 'price-high':
        orderColumn = 'price';
        orderAscending = false;
        break;
      case 'newest':
        orderColumn = 'created_at';
        orderAscending = false;
        break;
      case 'name':
        orderColumn = 'name';
        orderAscending = true;
        break;
      default: // relevance
        orderColumn = 'created_at';
        orderAscending = false;
    }

    // Pagination
    const offset = (Number(page) - 1) * Number(limit);
    query = query
      .order(orderColumn, { ascending: orderAscending })
      .range(offset, offset + Number(limit) - 1);

    const { data: products, error, count } = await query;

    if (error) {
      console.error('Search products error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to search products',
        error: error.message,
      });
    }

    res.status(200).json({
      status: 'success',
      data: products || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Search controller error:', error);
    next(error);
  }
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const {
      category,
      search,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 100, // Get all for now
    } = req.query;

    // Build Supabase query
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true); // ✅ Only return active (non-deleted) products

    // Filters
    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (minPrice) {
      query = query.gte('price', Number(minPrice));
    }

    if (maxPrice) {
      query = query.lte('price', Number(maxPrice));
    }

    // Sort
    let orderColumn = 'created_at';
    let orderAscending = false;
    
    if (sort === 'price-asc') {
      orderColumn = 'price';
      orderAscending = true;
    } else if (sort === 'price-desc') {
      orderColumn = 'price';
      orderAscending = false;
    } else if (sort === 'newest') {
      orderColumn = 'created_at';
      orderAscending = false;
    }

    // Apply sorting and pagination
    const offset = (Number(page) - 1) * Number(limit);
    query = query
      .order(orderColumn, { ascending: orderAscending })
      .range(offset, offset + Number(limit) - 1);

    const { data: products, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch products',
        error: error.message,
      });
    }

    // Fetch inventory data for all products
    if (products && products.length > 0) {
      const productIds = products.map(p => p.id);
      const { data: allInventory, error: inventoryError } = await supabase
        .from('product_inventory')
        .select('*')
        .in('product_id', productIds);

      if (!inventoryError && allInventory) {
        // Attach inventory to each product
        products.forEach(product => {
          const productInventory = allInventory.filter(inv => inv.product_id === product.id);
          if (productInventory.length > 0) {
            product.inventory = productInventory;
            product.variants = productInventory.map(inv => ({
              size: inv.size,
              stock: inv.stock,
              inStock: inv.stock > 0
            }));
            product.inStock = productInventory.some(inv => inv.stock > 0);
          }
        });
      }

      // Unpack specifications for frontend compatibility
      products.forEach(product => {
        if (product.specifications) {
          product.category = product.specifications.category || 'UNCATEGORIZED';
          product.subType = product.specifications.subType || '';
          product.material = product.specifications.material || '';
          product.label = product.specifications.label || null;
          product.color = product.specifications.color || '';
          product.colors = product.specifications.colors || [];
          product.sizes = product.specifications.sizes || [];
          // Fallback chain: specifications.images → top-level images column → empty array
          product.images = (product.specifications.images?.length > 0)
            ? product.specifications.images
            : (Array.isArray(product.images) && product.images.length > 0 ? product.images : []);
          product.washCare = product.specifications.washCare || [];
          product.rating = product.specifications.rating || 4.5;
          product.reviews = product.specifications.reviews || 0;
          if (product.inStock === undefined) {
            product.inStock = product.specifications.inStock !== false;
          }
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: products || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Controller error:', error);
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res, next) => {
  // Validate UUID format to prevent Postgres type cast errors
  if (!isValidUUID(req.params.id)) {
    return res.status(404).json({
      status: 'error',
      message: 'Product not found',
    });
  }
  try {
    const supabase = getSupabase();
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    // Fetch inventory data for this product
    const { data: inventory, error: inventoryError } = await supabase
      .from('product_inventory')
      .select('*')
      .eq('product_id', req.params.id);

    if (!inventoryError && inventory) {
      // Attach inventory data to product
      product.inventory = inventory;
      product.variants = inventory.map(inv => ({
        size: inv.size,
        stock: inv.stock,
        inStock: inv.stock > 0
      }));
    }

    // Unpack specifications for frontend compatibility (mirrors getProducts logic)
    if (product.specifications) {
      product.category = product.specifications.category || 'UNCATEGORIZED';
      product.subType = product.specifications.subType || '';
      product.material = product.specifications.material || '';
      product.label = product.specifications.label || null;
      product.color = product.specifications.color || '';
      product.colors = product.specifications.colors || [];
      product.sizes = product.specifications.sizes || [];
      product.images = (product.specifications.images?.length > 0)
        ? product.specifications.images
        : (Array.isArray(product.images) && product.images.length > 0 ? product.images : []);
      product.washCare = product.specifications.washCare || [];
      product.rating = product.specifications.rating || 4.5;
      product.reviews = product.specifications.reviews || 0;
      if (product.inStock === undefined) {
        product.inStock = product.specifications.inStock !== false;
      }
    }

    res.status(200).json({
      status: 'success',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res, next) => {
  try {
    // Use admin client for write operations to bypass RLS
    const supabase = getSupabaseAdmin();
    
    console.log('📦 Creating product with data:', JSON.stringify(req.body, null, 2));
    
    // Extract all fields from request body
    const {
      name,
      price,
      description,
      category,      // Frontend sends this as text like "SAREES"
      subType,       // Frontend sends sub-category
      material,
      label,
      color,
      colors,
      sizes,
      images,
      washCare,
      rating,
      reviews,
      inStock,
      variants,
      // Any other fields
      ...otherFields
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        status: 'error',
        message: 'Product name is required',
      });
    }

    if (price === undefined || price === null) {
      return res.status(400).json({
        status: 'error',
        message: 'Product price is required',
      });
    }

    // Generate a unique slug from name
    const baseSlug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const uniqueSlug = `${baseSlug}-${Date.now()}`;

    // Strip any base64/blob images before storing – only real URLs go in DB
    const cleanedImages = cleanImageArray(images);

    // Build the product data object with ONLY columns that exist in the database
    // Extra fields go into the 'specifications' JSONB column
    const productData = {
      name: name,
      slug: uniqueSlug,
      description: description || '',
      price: Number(price) || 0,
      is_active: true,
      is_featured: label === 'LIMITED' || label === 'SALE',
      is_new_arrival: label === 'NEW',
      is_bestseller: false,
      // Store all extra frontend fields in specifications JSONB
      specifications: {
        category: category || 'UNCATEGORIZED',
        subType: subType || '',
        material: material || '',
        label: label || null,
        color: color || '',
        colors: colors || [],
        sizes: sizes || ['S', 'M', 'L'],
        images: cleanedImages,  // only real URLs, no base64
        washCare: washCare || [],
        rating: rating || 4.5,
        reviews: reviews || 0,
        inStock: inStock !== false,
        ...otherFields
      },
      tags: category ? [category, subType].filter(Boolean) : [],
      created_by: req.user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('📝 Mapped product data for database:', JSON.stringify(productData, null, 2));

    const { data: product, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (error) {
      console.error('❌ Create product error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create product: ' + error.message,
        error: error.message,
        details: error.details || null,
      });
    }

    console.log('✅ Product created in database:', product.id);

    // Create inventory entries for each size
    const sizesArray = sizes || ['S', 'M', 'L'];
    if (sizesArray.length > 0) {
      const inventoryEntries = sizesArray.map(size => ({
        product_id: product.id,
        size: size,
        stock: 50, // Default stock
        is_active: true, // Explicitly set so .neq('is_active', false) queries always match
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: inventoryError } = await supabase
        .from('product_inventory')
        .insert(inventoryEntries);

      if (inventoryError) {
        console.error('⚠️ Create inventory error (non-fatal):', inventoryError.message);
        // Don't fail the whole operation, just log the error
      } else {
        console.log(`✅ Created ${inventoryEntries.length} inventory entries for product ${product.id}`);
      }
    }

    // Return product with specifications unpacked for frontend compatibility
    const responseProduct = {
      ...product,
      // Unpack specifications for frontend
      category: product.specifications?.category || category,
      subType: product.specifications?.subType || subType,
      material: product.specifications?.material || material,
      label: product.specifications?.label || label,
      color: product.specifications?.color || color,
      colors: product.specifications?.colors || colors || [],
      sizes: product.specifications?.sizes || sizes || [],
      images: cleanImageArray(product.specifications?.images || cleanedImages),
      washCare: product.specifications?.washCare || washCare || [],
      rating: product.specifications?.rating || rating || 4.5,
      reviews: product.specifications?.reviews || reviews || 0,
      inStock: product.specifications?.inStock !== false,
    };

    res.status(201).json({
      status: 'success',
      data: responseProduct,
    });
  } catch (error) {
    console.error('❌ Controller error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message,
      error: error.message,
    });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res, next) => {
  try {
    // Validate UUID format to prevent Postgres type errors
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid product ID format. Products use UUID identifiers.',
      });
    }

    // Use admin client for write operations to bypass RLS
    const supabase = getSupabaseAdmin();
    const { data: existing, error: findError } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    // Whitelist valid columns and map camelCase to snake_case where needed
    const validFields = [
      'name', 'description', 'price', 'category', 'category_id', 'brand', 
      'barcode', 'color', 'colors', 'compare_at_price', 'cost_price',
      'dimensions', 'images', 'in_stock', 'is_active', 'is_bestseller', 
      'is_featured', 'is_new_arrival', 'label', 'low_stock_threshold', 
      'material', 'rating', 'reviews', 'seo_description', 'seo_keywords', 
      'seo_title', 'short_description', 'sizes', 'sku', 'slug', 
      'specifications', 'stock', 'stock_enabled', 'sub_type', 'tags', 
      'total_stock', 'wash_care', 'weight'
    ];

    // Build updateData by mapping and validating fields
    const updateData = { updated_at: new Date().toISOString() };
    
    for (const key in req.body) {
      // Map camelCase to snake_case for specific fields
      if (key === 'subType') {
        updateData.sub_type = req.body[key];
      } else if (key === 'images') {
        // Strip base64/blob from images before storing
        updateData[key] = cleanImageArray(req.body[key]);
      } else if (validFields.includes(key)) {
        updateData[key] = req.body[key];
      }
      // Silently ignore invalid fields
    }

    // CRITICAL: Sync ALL spec-related fields into specifications JSONB.
    // Products store category, colors, washCare, sizes, material, label, etc.
    // ONLY inside the specifications JSONB column.
    // getProducts() reads product.specifications.xxx to expose these as top-level fields.
    // So any update to these fields MUST be written into specifications, not just top-level columns.
    const specFields = {};
    if (updateData.images !== undefined) specFields.images = updateData.images; // already cleaned
    if (req.body.colors !== undefined) specFields.colors = req.body.colors;
    if (req.body.color !== undefined) specFields.color = req.body.color;
    if (req.body.washCare !== undefined) specFields.washCare = req.body.washCare;   // camelCase from frontend
    if (req.body.sizes !== undefined) specFields.sizes = req.body.sizes;
    if (req.body.material !== undefined) specFields.material = req.body.material;
    if (req.body.label !== undefined) specFields.label = req.body.label;
    if (req.body.subType !== undefined) specFields.subType = req.body.subType;
    if (req.body.category !== undefined) specFields.category = req.body.category;
    if (req.body.rating !== undefined) specFields.rating = req.body.rating;
    if (req.body.reviews !== undefined) specFields.reviews = req.body.reviews;
    if (req.body.description !== undefined) specFields.description = req.body.description;

    // Merge all spec updates into the existing specifications object
    if (Object.keys(specFields).length > 0) {
      updateData.specifications = {
        ...(existing.specifications || {}),
        ...specFields,
      };
      // If specifications were explicitly sent in body, clean any images inside them too
      if (updateData.specifications?.images) {
        updateData.specifications.images = cleanImageArray(updateData.specifications.images);
      }
    }

    console.log('📝 Update product with data:', Object.keys(updateData).join(', '));
    if (specFields.colors) console.log('   colors →', specFields.colors);
    if (specFields.washCare) console.log('   washCare →', specFields.washCare);

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      console.error('Update product error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update product',
        error: error.message,
      });
    }

    // Unpack specifications for frontend compatibility (mirrors getProduct/getProducts)
    const responseProduct = { ...product };
    if (product.specifications) {
      responseProduct.category = product.specifications.category || product.category || 'UNCATEGORIZED';
      responseProduct.subType = product.specifications.subType || '';
      responseProduct.material = product.specifications.material || '';
      responseProduct.label = product.specifications.label || null;
      responseProduct.color = product.specifications.color || '';
      responseProduct.colors = product.specifications.colors || [];
      responseProduct.sizes = product.specifications.sizes || [];
      responseProduct.images = (product.specifications.images?.length > 0)
        ? product.specifications.images
        : (Array.isArray(product.images) && product.images.length > 0 ? product.images : []);
      responseProduct.washCare = product.specifications.washCare || [];
      responseProduct.rating = product.specifications.rating || 4.5;
      responseProduct.reviews = product.specifications.reviews || 0;
    }

    res.status(200).json({
      status: 'success',
      data: responseProduct,
    });
  } catch (error) {
    console.error('Controller error:', error);
    next(error);
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res, next) => {
  console.log('🗑️  DELETE product called - Product ID:', req.params.id);
  console.log('🔑 Auth user:', req.user?.email, 'Role:', req.user?.role);
  
  // Validate UUID format to prevent Postgres type errors (numeric / legacy IDs)
  if (!isValidUUID(req.params.id)) {
    console.log('❌ Invalid UUID format:', req.params.id);
    return res.status(400).json({
      status: 'error',
      message: 'Invalid product ID format. This product may be from an old local-storage session and does not exist in the database. Please refresh the product list.',
    });
  }

  try {
    // Use admin client for write operations to bypass RLS
    const supabase = getSupabaseAdmin();
    const { data: product, error: findError } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (findError || !product) {
      console.log('❌ Product not found:', req.params.id);
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    console.log('✅ Product found, attempting delete:', product.name);

    // ── CASCADE: remove dependent rows first to avoid FK constraint errors ──
    const productId = req.params.id;

    // 1) Remove inventory entries
    const { error: invErr } = await supabase
      .from('product_inventory')
      .delete()
      .eq('product_id', productId);
    if (invErr) console.warn('⚠️  Inventory cleanup error (non-fatal):', invErr.message);
    else console.log('  ✅ Inventory entries removed');

    // 2) Remove product variants
    const { error: varErr } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', productId);
    if (varErr) console.warn('⚠️  Variant cleanup error (non-fatal):', varErr.message);
    else console.log('  ✅ Variant entries removed');

    // 3) Remove cart items referencing this product
    const { error: cartErr } = await supabase
      .from('cart_items')
      .delete()
      .eq('product_id', productId);
    if (cartErr) console.warn('⚠️  Cart cleanup error (non-fatal):', cartErr.message);
    else console.log('  ✅ Cart items removed');

    // 4) Soft-delete the product: set is_active = false
    // This keeps all order_items references intact (no FK violation)
    // Product disappears from store and admin dashboard immediately
    const { error: deleteError } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId);

    if (deleteError) {
      console.error('❌ Soft-delete product error:', deleteError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete product: ' + deleteError.message,
        error: deleteError.message,
      });
    }

    console.log('✅ Product soft-deleted (is_active = false):', req.params.id);
    res.status(200).json({
      status: 'success',
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('❌ Controller error in deleteProduct:', error);
    // Don't crash the server - return error gracefully
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// @desc    Add a single variant to a product
// @route   POST /api/products/:id/single-variant
// @access  Private/Admin
export const addSingleVariant = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const productId = req.params.id;
    const { size, color, sku, stock, material } = req.body;

    console.log('📦 Adding single variant to product:', productId, { size, color, sku, stock, material });

    // Validate required fields
    if (!size) {
      return res.status(400).json({
        status: 'error',
        message: 'Size is required for variant',
      });
    }

    // Check if product exists
    const { data: product, error: findError } = await supabase
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .single();

    if (findError || !product) {
      console.error('❌ Product not found:', productId);
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    // Generate SKU if not provided
    const generatedSku = sku || `${productId.substring(0, 8)}-${size}-${color || 'DEFAULT'}`.toUpperCase();

    // Create the variant
    const variantData = {
      product_id: productId,
      size: size,
      color: color || null,
      material: material || null,
      sku: generatedSku,
      stock: stock || 0,
      auto_generated: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: variant, error } = await supabase
      .from('product_inventory')
      .insert([variantData])
      .select()
      .single();

    if (error) {
      console.error('❌ Create variant error:', error);
      // Check for duplicate
      if (error.code === '23505') {
        return res.status(400).json({
          status: 'error',
          message: 'A variant with this size and color already exists',
        });
      }
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create variant: ' + error.message,
        error: error.message,
      });
    }

    console.log('✅ Variant created:', variant.id);

    res.status(201).json({
      status: 'success',
      data: variant,
    });
  } catch (error) {
    console.error('❌ Controller error in addSingleVariant:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message,
    });
  }
};

// @desc    Auto-generate variants from sizes and colors
// @route   POST /api/products/:id/auto-variants
// @access  Private/Admin
export const autoGenerateVariants = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const productId = req.params.id;
    const { sizes, colors, materials, defaultStock = 50 } = req.body;

    console.log('🔄 Auto-generating variants for product:', productId, { sizes, colors, materials });

    // Validate inputs
    if (!sizes || !Array.isArray(sizes) || sizes.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Sizes array is required',
      });
    }

    // Check if product exists
    const { data: product, error: findError } = await supabase
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .single();

    if (findError || !product) {
      console.error('❌ Product not found:', productId);
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    // Get existing variants to avoid duplicates
    const { data: existingVariants } = await supabase
      .from('product_inventory')
      .select('size, color, material')
      .eq('product_id', productId);

    const existingCombos = new Set(
      (existingVariants || []).map(v => `${v.size}-${v.color || 'DEFAULT'}-${v.material || 'DEFAULT'}`)
    );

    // Generate cartesian product of sizes × colors × materials
    const colorList = colors && colors.length > 0 ? colors : [null];
    const materialList = materials && materials.length > 0 ? materials : [null];
    const variantsToCreate = [];

    for (const size of sizes) {
      for (const color of colorList) {
        for (const material of materialList) {
          const comboKey = `${size}-${color || 'DEFAULT'}-${material || 'DEFAULT'}`;
          
          // Skip if already exists
          if (existingCombos.has(comboKey)) {
            console.log(`⏭️ Skipping existing combo: ${comboKey}`);
            continue;
          }

          const skuParts = [productId.substring(0, 8), size, color || 'DEFAULT'];
          if (material) skuParts.push(material);
          const sku = skuParts.join('-').toUpperCase();
          
          variantsToCreate.push({
            product_id: productId,
            size: size,
            color: color,
            material: material || null,
            sku: sku,
            stock: defaultStock,
            auto_generated: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (variantsToCreate.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'All variants already exist',
        data: {
          created: [],
          skipped: sizes.length * colorList.length * materialList.length,
        },
      });
    }

    // Insert all variants in batch
    const { data: createdVariants, error } = await supabase
      .from('product_inventory')
      .insert(variantsToCreate)
      .select();

    if (error) {
      console.error('❌ Auto-generate variants error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to generate variants: ' + error.message,
        error: error.message,
      });
    }

    console.log(`✅ Created ${createdVariants.length} variants for product ${productId}`);

    res.status(201).json({
      status: 'success',
      message: `Created ${createdVariants.length} variants`,
      data: {
        created: createdVariants,
        count: createdVariants.length,
      },
    });
  } catch (error) {
    console.error('❌ Controller error in autoGenerateVariants:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message,
    });
  }
};

// @desc    Get all variants for a product
// @route   GET /api/products/:id/variants
// @access  Public
export const getProductVariants = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const productId = req.params.id;

    const { data: variants, error } = await supabase
      .from('product_inventory')
      .select('*')
      .eq('product_id', productId)
      .order('size', { ascending: true });

    if (error) {
      console.error('❌ Get variants error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch variants',
        error: error.message,
      });
    }

    res.status(200).json({
      status: 'success',
      data: variants || [],
    });
  } catch (error) {
    console.error('❌ Controller error in getProductVariants:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message,
    });
  }
};

// @desc    Update product stock
// @route   PUT /api/products/:id/stock
// @access  Private/Admin
export const updateStock = async (req, res, next) => {
  try {
    // Use admin client for write operations to bypass RLS
    const supabase = getSupabaseAdmin();
    const { variants } = req.body; // Array of { size, stock }

    const { data: product, error: findError } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (findError || !product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    // Update or insert inventory entries for each variant
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const inventoryEntries = variants.map(variant => ({
        product_id: req.params.id,
        size: variant.size || variant.name,
        stock: variant.stock || variant.quantity || 0,
        updated_at: new Date().toISOString(),
      }));

      const { data: inventory, error } = await supabase
        .from('product_inventory')
        .upsert(inventoryEntries, {
          onConflict: 'product_id,size',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('Update stock error:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to update stock',
          error: error.message,
        });
      }

      for (const variant of variants) {
        const newStockLevel = Number(variant.stock || variant.quantity || 0);
        const productName = product.name;
        const variantInfo = variant.size || variant.name || 'N/A';
        const productId = req.params.id;

        if (newStockLevel < 5) {
          await sendAdminNotification({
            type: 'LOW STOCK',
            order: { id: 'N/A' },
            product: { name: productName, variant: variantInfo || 'N/A' },
            user: null,
            reason: `Stock for ${productName} dropped to ${newStockLevel} units`,
          });

          await logOrderEvent({
            orderId: null,
            userId: null,
            type: 'LOW_STOCK_ALERT',
            description: `Low stock alert: ${productName} has ${newStockLevel} units remaining`,
          });

          await createAdminNotification({
            type: 'LOW_STOCK_ALERT',
            message: `Low stock: ${productName} is down to ${newStockLevel} units`,
            referenceId: productId,
          });
        }
      }

      res.status(200).json({
        status: 'success',
        data: inventory,
        message: `Updated stock for ${inventoryEntries.length} variants`,
      });
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'No variants provided for stock update',
      });
    }
  } catch (error) {
    console.error('Controller error:', error);
    next(error);
  }
};
