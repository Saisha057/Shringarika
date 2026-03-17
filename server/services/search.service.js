import { getSupabase } from '../config/supabase.js';
import { cacheGet, cacheSet } from '../config/redis.js';

// Fuzzy search helper
const calculateLevenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

export class SearchService {
  constructor() {
    this.supabase = getSupabase();
  }

  // Get search suggestions with autocomplete
  async getSearchSuggestions(query, limit = 10) {
    try {
      const cacheKey = `search:suggestions:${query.toLowerCase()}`;
      const cached = await cacheGet(cacheKey);
      
      if (cached) {
        return cached;
      }

      const { data: products } = await this.supabase
        .from('products')
        .select('name, category')
        .or(`name.ilike.%${query}%,category.ilike.%${query}%`)
        .limit(limit);

      const suggestions = [
        ...new Set([
          ...products.map(p => p.name),
          ...products.map(p => p.category)
        ])
      ].slice(0, limit);

      await cacheSet(cacheKey, suggestions, 3600); // Cache for 1 hour
      return suggestions;
    } catch (error) {
      console.error('Search suggestions error:', error);
      return [];
    }
  }

  // Advanced search with fuzzy matching
  async advancedSearch(params) {
    try {
      const {
        query,
        category,
        minPrice,
        maxPrice,
        colors,
        inStock,
        sortBy = 'relevance',
        page = 1,
        limit = 20
      } = params;

      let queryBuilder = this.supabase
        .from('products')
        .select('*', { count: 'exact' });

      // Search query with fuzzy matching
      if (query) {
        queryBuilder = queryBuilder.or(
          `name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`
        );
      }

      // Filters
      if (category) {
        queryBuilder = queryBuilder.eq('category', category);
      }

      if (minPrice) {
        queryBuilder = queryBuilder.gte('price', minPrice);
      }

      if (maxPrice) {
        queryBuilder = queryBuilder.lte('price', maxPrice);
      }

      if (colors && colors.length > 0) {
        queryBuilder = queryBuilder.contains('colors', colors);
      }

      if (inStock) {
        queryBuilder = queryBuilder.gt('stock', 0);
      }

      // Sorting
      switch (sortBy) {
        case 'price_asc':
          queryBuilder = queryBuilder.order('price', { ascending: true });
          break;
        case 'price_desc':
          queryBuilder = queryBuilder.order('price', { ascending: false });
          break;
        case 'newest':
          queryBuilder = queryBuilder.order('created_at', { ascending: false });
          break;
        case 'popular':
          queryBuilder = queryBuilder.order('sales_count', { ascending: false });
          break;
        default: // relevance
          queryBuilder = queryBuilder.order('name', { ascending: true });
      }

      // Pagination
      const offset = (page - 1) * limit;
      queryBuilder = queryBuilder.range(offset, offset + limit - 1);

      const { data, error, count } = await queryBuilder;

      if (error) throw error;

      // Track search analytics
      await this.trackSearch(query, data.length);

      return {
        products: data,
        totalCount: count,
        page,
        totalPages: Math.ceil(count / limit),
        hasMore: offset + limit < count
      };
    } catch (error) {
      console.error('Advanced search error:', error);
      throw error;
    }
  }

  // Track search analytics
  async trackSearch(query, resultCount) {
    try {
      if (!query) return;

      await this.supabase.from('search_analytics').insert({
        query: query.toLowerCase(),
        result_count: resultCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Search tracking error:', error);
    }
  }

  // Get trending searches
  async getTrendingSearches(limit = 10) {
    try {
      const cacheKey = 'search:trending';
      const cached = await cacheGet(cacheKey);
      
      if (cached) {
        return cached;
      }

      const { data } = await this.supabase
        .from('search_analytics')
        .select('query')
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('query', { ascending: false })
        .limit(limit);

      const trending = data ? [...new Set(data.map(d => d.query))] : [];
      await cacheSet(cacheKey, trending, 1800); // Cache for 30 minutes
      
      return trending;
    } catch (error) {
      console.error('Trending searches error:', error);
      return [];
    }
  }

  // Spell correction suggestions
  async getSpellingSuggestions(query) {
    try {
      const { data: products } = await this.supabase
        .from('products')
        .select('name');

      const suggestions = [];
      const queryLower = query.toLowerCase();

      for (const product of products) {
        const distance = calculateLevenshteinDistance(queryLower, product.name.toLowerCase());
        if (distance <= 3) {
          suggestions.push({ term: product.name, distance });
        }
      }

      return suggestions
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
        .map(s => s.term);
    } catch (error) {
      console.error('Spelling suggestions error:', error);
      return [];
    }
  }
}

export default new SearchService();
