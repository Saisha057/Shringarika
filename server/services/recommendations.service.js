/**
 * Product Recommendation Engine
 * 
 * Strategies:
 * 1. Collaborative Filtering - "Customers who bought X also bought Y"
 * 2. Content-Based Filtering - Similar products based on category, tags, attributes
 * 3. Trending Products - Most viewed/purchased recently
 * 4. Personalized - Based on user's browsing/purchase history
 */

import { getSupabaseAdmin } from '../config/supabase.js';

/**
 * Get personalized recommendations for user
 * @param {string} userId - User ID
 * @param {number} limit - Number of recommendations
 */
export const getPersonalizedRecommendations = async (userId, limit = 8) => {
  const supabase = getSupabaseAdmin();
  try {
    // Get user's purchase history
    const { data: orders } = await supabase
      .from('orders')
      .select('items')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Extract product IDs from orders
    const purchasedProductIds = new Set();
    orders?.forEach(order => {
      order.items?.forEach(item => {
        purchasedProductIds.add(item.product_id);
      });
    });

    // Get user's browsing history (from analytics)
    const { data: viewedProducts } = await supabase
      .from('analytics_events')
      .select('product_id')
      .eq('user_id', userId)
      .eq('event_type', 'product_view')
      .order('created_at', { ascending: false })
      .limit(20);

    const viewedProductIds = new Set(viewedProducts?.map(v => v.product_id) || []);

    // Combine purchased and viewed for interest profiling
    const interestProductIds = [...purchasedProductIds, ...viewedProductIds];

    if (interestProductIds.length === 0) {
      // No history, return trending products
      return await getTrendingProducts(limit);
    }

    // Get categories of interested products
    const { data: interestedProducts } = await supabase
      .from('products')
      .select('category_id, tags')
      .in('id', interestProductIds);

    const categoryIds = [...new Set(interestedProducts?.map(p => p.category_id) || [])];
    const allTags = interestedProducts?.flatMap(p => p.tags || []) || [];
    const topTags = getTopN(allTags, 5);

    // Find similar products
    const { data: recommendations } = await supabase
      .from('products')
      .select('*')
      .in('category_id', categoryIds)
      .eq('is_active', true)
      .gt('stock_quantity', 0)
      .not('id', 'in', `(${interestProductIds.join(',')})`)
      .limit(limit * 2); // Get more for filtering

    // Score and rank recommendations
    const scored = recommendations?.map(product => {
      let score = 0;
      
      // Category match bonus
      if (categoryIds.includes(product.category_id)) score += 3;
      
      // Tag match bonus
      const matchingTags = product.tags?.filter(tag => topTags.includes(tag)) || [];
      score += matchingTags.length * 2;
      
      // Rating bonus
      score += (product.average_rating || 0) * 0.5;
      
      // Popularity bonus (review count)
      score += Math.log(product.review_count + 1) * 0.3;

      return { ...product, recommendationScore: score };
    });

    // Sort by score and return top N
    scored?.sort((a, b) => b.recommendationScore - a.recommendationScore);
    return scored?.slice(0, limit) || [];

  } catch (error) {
    console.error('Personalized recommendations error:', error);
    return [];
  }
};

/**
 * Get "You may also like" for a product
 * Collaborative filtering based on purchase patterns
 */
export const getSimilarProducts = async (productId, limit = 6) => {
  const supabase = getSupabaseAdmin();
  try {
    // Get the product details
    const { data: product } = await supabase
      .from('products')
      .select('category_id, tags, price')
      .eq('id', productId)
      .single();

    if (!product) return [];

    // Strategy 1: Same category, similar price range
    const priceMin = product.price * 0.7;
    const priceMax = product.price * 1.5;

    const { data: similarProducts } = await supabase
      .from('products')
      .select('*')
      .eq('category_id', product.category_id)
      .neq('id', productId)
      .gte('price', priceMin)
      .lte('price', priceMax)
      .eq('is_active', true)
      .gt('stock_quantity', 0)
      .order('average_rating', { ascending: false })
      .limit(limit);

    return similarProducts || [];

  } catch (error) {
    console.error('Similar products error:', error);
    return [];
  }
};

/**
 * Get "Frequently bought together"
 * Based on actual order patterns
 */
export const getFrequentlyBoughtTogether = async (productId, limit = 3) => {
  const supabase = getSupabaseAdmin();
  try {
    // Get all orders containing this product
    const { data: orders } = await supabase
      .from('orders')
      .select('items')
      .contains('items', [{ product_id: productId }])
      .limit(100);

    // Count co-occurrences
    const coOccurrences = {};
    
    orders?.forEach(order => {
      const productIds = order.items?.map(item => item.product_id) || [];
      
      productIds.forEach(pid => {
        if (pid !== productId) {
          coOccurrences[pid] = (coOccurrences[pid] || 0) + 1;
        }
      });
    });

    // Sort by frequency
    const sortedProducts = Object.entries(coOccurrences)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([pid]) => pid);

    if (sortedProducts.length === 0) return [];

    // Get product details
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', sortedProducts)
      .eq('is_active', true)
      .gt('stock_quantity', 0);

    return products || [];

  } catch (error) {
    console.error('Frequently bought together error:', error);
    return [];
  }
};

/**
 * Get trending products
 * Based on recent views and purchases
 */
export const getTrendingProducts = async (limit = 8) => {
  const supabase = getSupabaseAdmin();
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get recent product views
    const { data: recentViews } = await supabase
      .from('analytics_events')
      .select('product_id')
      .eq('event_type', 'product_view')
      .gte('created_at', sevenDaysAgo.toISOString());

    // Count views per product
    const viewCounts = {};
    recentViews?.forEach(view => {
      viewCounts[view.product_id] = (viewCounts[view.product_id] || 0) + 1;
    });

    // Sort by view count
    const trendingIds = Object.entries(viewCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([pid]) => pid);

    if (trendingIds.length === 0) {
      // Fallback: Get highest rated products
      const { data: topRated } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .gt('stock_quantity', 0)
        .order('average_rating', { ascending: false })
        .limit(limit);

      return topRated || [];
    }

    // Get product details
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', trendingIds)
      .eq('is_active', true)
      .gt('stock_quantity', 0);

    return products || [];

  } catch (error) {
    console.error('Trending products error:', error);
    return [];
  }
};

/**
 * Get new arrivals
 */
export const getNewArrivals = async (limit = 8) => {
  const supabase = getSupabaseAdmin();
  try {
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .gt('stock_quantity', 0)
      .order('created_at', { ascending: false })
      .limit(limit);

    return products || [];

  } catch (error) {
    console.error('New arrivals error:', error);
    return [];
  }
};

/**
 * Get best sellers
 */
export const getBestSellers = async (limit = 8) => {
  const supabase = getSupabaseAdmin();
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get order items from last 30 days
    const { data: orders } = await supabase
      .from('orders')
      .select('items')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('status', 'delivered');

    // Count sales per product
    const salesCounts = {};
    orders?.forEach(order => {
      order.items?.forEach(item => {
        salesCounts[item.product_id] = (salesCounts[item.product_id] || 0) + item.quantity;
      });
    });

    // Sort by sales count
    const bestSellerIds = Object.entries(salesCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([pid]) => pid);

    if (bestSellerIds.length === 0) return [];

    // Get product details
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', bestSellerIds)
      .eq('is_active', true);

    return products || [];

  } catch (error) {
    console.error('Best sellers error:', error);
    return [];
  }
};

/**
 * Helper: Get top N most frequent items
 */
function getTopN(items, n) {
  const counts = {};
  items.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([item]) => item);
}

export default {
  getPersonalizedRecommendations,
  getSimilarProducts,
  getFrequentlyBoughtTogether,
  getTrendingProducts,
  getNewArrivals,
  getBestSellers,
};
