import { useState, useEffect, useMemo } from 'react';
import { Search, X, ChevronLeft, Star } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

interface SearchPageProps {
  onNavigateHome: () => void;
  onViewProduct: (productId: number) => void;
}

export function SearchPage({ onNavigateHome, onViewProduct }: SearchPageProps) {
  const { products } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000]);
  const [showFilters, setShowFilters] = useState(false);

  const categories = ['ALL', 'SAREES', 'UNSTITCHED SUIT', 'PURE GEORGETTE KURTI', 'CHANDERI SILK', 'MUSLIN CLOTH', 'MUL COTTON', 'BOTTOM WEARS'];

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-focus search input on mount
  useEffect(() => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.focus();
    }
  }, []);

  // Save search to recent searches
  const saveSearch = (query: string) => {
    if (!query.trim() || query.length < 2) return;

    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Handle search submission
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      saveSearch(searchQuery.trim());
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
  };

  // Remove recent search
  const removeRecentSearch = (search: string) => {
    const updated = recentSearches.filter(s => s !== search);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Use a recent search
  const useRecentSearch = (search: string) => {
    setSearchQuery(search);
    setDebouncedQuery(search);
  };

  // Filter and search products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Filter by search query
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase();
      filtered = filtered.filter(product => {
        const nameMatch = product.name.toLowerCase().includes(query);
        const categoryMatch = product.category?.toLowerCase().includes(query);
        const colorMatch = product.color?.toLowerCase().includes(query);
        const descriptionMatch = product.description?.toLowerCase().includes(query);
        
        return nameMatch || categoryMatch || colorMatch || descriptionMatch;
      });
    }

    // Filter by category
    if (selectedCategory !== 'ALL') {
      if (selectedCategory === 'NEW IN') {
        filtered = filtered.filter(p => p.label === 'NEW');
      } else {
        filtered = filtered.filter(p => p.category === selectedCategory);
      }
    }

    // Filter by price range
    filtered = filtered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

    return filtered;
  }, [debouncedQuery, selectedCategory, priceRange]);

  // Show suggested products when no search
  const suggestedProducts = useMemo(() => {
    // Show NEW or BEST SELLER products, or just any products if those don't exist
    const labeled = products.filter(p => p.label === 'NEW' || p.label === 'BEST SELLER');
    return labeled.length > 0 ? labeled.slice(0, 8) : products.slice(0, 8);
  }, [products]);

  const displayProducts = debouncedQuery.trim() ? filteredProducts : suggestedProducts;
  const showNoResults = debouncedQuery.trim() && filteredProducts.length === 0;

  return (
    <div className="bg-white min-h-screen animate-fadeIn">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <button 
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-sm hover:underline mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>BACK TO HOME</span>
          </button>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative">
            <div className="relative flex items-center">
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for products..."
                className="w-full pl-8 pr-32 py-4 border-2 border-neutral-300 rounded-full text-base focus:outline-none focus:border-black transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-4 p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-600" />
                </button>
              )}
            </div>

            {/* Recent Searches */}
            {!debouncedQuery && recentSearches.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-2xl shadow-lg p-4 z-50">
                <h3 className="text-sm tracking-wider text-neutral-600 mb-3">RECENT SEARCHES</h3>
                <div className="space-y-2">
                  {recentSearches.map((search, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between hover:bg-neutral-50 p-2 rounded-lg transition-colors"
                    >
                      <button
                        onClick={() => useRecentSearch(search)}
                        className="flex-1 text-left text-sm"
                      >
                        {search}
                      </button>
                      <button
                        onClick={() => removeRecentSearch(search)}
                        className="p-1 hover:bg-neutral-200 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-neutral-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-neutral-50 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm tracking-wider text-neutral-600">
              {debouncedQuery.trim() 
                ? `${filteredProducts.length} RESULTS FOR "${debouncedQuery}"`
                : 'SUGGESTED FOR YOU'}
            </h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm tracking-wider text-black hover:underline"
            >
              {showFilters ? 'HIDE FILTERS' : 'SHOW FILTERS'}
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="space-y-4 pb-4 animate-slideDown">
              {/* Category Filter */}
              <div>
                <h3 className="text-sm tracking-wider mb-2">CATEGORY</h3>
                <div className="flex gap-2 flex-wrap">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 border rounded-full text-sm transition-colors ${
                        selectedCategory === category
                          ? 'bg-black text-white border-black'
                          : 'bg-white border-neutral-300 hover:border-black'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range Filter */}
              <div>
                <h3 className="text-sm tracking-wider mb-2">
                  PRICE RANGE: ₹{priceRange[0]} - ₹{priceRange[1]}
                </h3>
                <div className="flex gap-4 items-center">
                  <input
                    type="range"
                    min="0"
                    max="2000"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                    className="flex-1"
                  />
                  <input
                    type="range"
                    min="0"
                    max="2000"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {showNoResults ? (
          <div className="text-center py-20">
            <div className="mb-6">
              <Search className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h2 className="text-2xl tracking-wider mb-2">NO PRODUCTS FOUND</h2>
              <p className="text-neutral-600">
                Try another search or explore our suggested products below
              </p>
            </div>

            {/* Show suggested products */}
            <div className="mt-12">
              <h3 className="text-xl tracking-wider mb-6">YOU MAY ALSO LIKE</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {suggestedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="group cursor-pointer animate-fadeIn"
                    onClick={() => onViewProduct(product.id)}
                  >
                    <div className="relative bg-neutral-100 aspect-3/4 mb-3 overflow-hidden rounded-lg">
                      {(product.images && product.images.length > 0) || product.image ? (
                        <img 
                          src={product.images?.[0] || product.image} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                          <span className="text-neutral-400 text-sm">IMAGE</span>
                        </div>
                      )}
                      {product.label && (
                        <div className="absolute top-3 left-3 bg-black text-white px-3 py-1 text-xs tracking-wider rounded-full">
                          {product.label}
                        </div>
                      )}
                    </div>
                    <h3 className="text-sm tracking-wider mb-1 group-hover:underline">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < Math.floor(product.rating)
                                ? 'fill-black stroke-black'
                                : 'stroke-neutral-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-neutral-500">({product.reviews})</span>
                    </div>
                    <p className="text-base">₹{Number(product.price || 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {displayProducts.map((product) => (
              <div
                key={product.id}
                className="group cursor-pointer animate-fadeIn"
                onClick={() => onViewProduct(product.id)}
              >
                <div className="relative bg-neutral-100 aspect-3/4 mb-3 overflow-hidden rounded-lg">
                  {(product.images && product.images.length > 0) || product.image ? (
                    <img 
                      src={product.images?.[0] || product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                      <span className="text-neutral-400 text-sm">IMAGE</span>
                    </div>
                  )}
                  {product.label && (
                    <div className="absolute top-3 left-3 bg-black text-white px-3 py-1 text-xs tracking-wider rounded-full">
                      {product.label}
                    </div>
                  )}
                  {/* Quick View Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewProduct(product.id);
                    }}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-2 text-xs tracking-wider rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-neutral-100"
                  >
                    QUICK VIEW
                  </button>
                </div>
                <h3 className="text-sm tracking-wider mb-1 group-hover:underline">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < Math.floor(product.rating)
                            ? 'fill-black stroke-black'
                            : 'stroke-neutral-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-neutral-500">({product.reviews})</span>
                </div>
                <p className="text-base">₹{Number(product.price || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
