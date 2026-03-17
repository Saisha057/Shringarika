import { supabase } from '../config/supabase.js';
import { deleteFromCloudinary } from '../utils/cloudinary.config.js';

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      color,
      size,
      material,
      sort,
      page = 1,
      limit = 12,
      isNewArrival,
      isFeatured,
    } = req.query;

    // Build Supabase query
    let query = supabase
      .from('products')
      .select('*');

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

    if (color) {
      query = query.contains('colors', [color]);
    }

    if (size) {
      query = query.contains('sizes', [size]);
    }

    if (material) {
      query = query.eq('material', material);
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
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch products',
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
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('reviews.user', 'name');

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res, next) => {
  try {
    req.body.createdBy = req.user.id;

    const product = await Product.create(req.body);

    res.status(201).json({
      status: 'success',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      status: 'success',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    // Delete images from Cloudinary
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        if (image.public_id) {
          await deleteFromCloudinary(image.public_id);
        }
      }
    }

    await product.deleteOne();

    res.status(200).json({
      status: 'success',
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product review
// @route   POST /api/products/:id/reviews
// @access  Private
export const createProductReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    // Check if user already reviewed
    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user.id.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({
        status: 'error',
        message: 'Product already reviewed',
      });
    }

    const review = {
      user: req.user.id,
      name: req.user.name,
      rating: Number(rating),
      comment,
    };

    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    product.rating =
      product.reviews.reduce((acc, item) => item.rating + acc, 0) /
      product.reviews.length;

    await product.save();

    res.status(201).json({
      status: 'success',
      message: 'Review added',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get top rated products
// @route   GET /api/products/top
// @access  Public
export const getTopProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isVisible: true })
      .sort({ rating: -1 })
      .limit(5);

    res.status(200).json({
      status: 'success',
      data: { products },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product stock
// @route   PUT /api/products/:id/stock
// @access  Private/Admin
export const updateStock = async (req, res, next) => {
  try {
    const { stock } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    product.stock = new Map(Object.entries(stock));
    product.totalStock = Object.values(stock).reduce((acc, val) => acc + val, 0);

    await product.save();

    res.status(200).json({
      status: 'success',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};
