import { useEffect } from 'react';
import type { Product } from '../data/products';

const MAX_RECENTLY_VIEWED = 12;
const STORAGE_KEY = 'recentlyViewed';

export interface RecentlyViewedItem {
  id: number;
  name: string;
  price: number;
  image?: string;
  category?: string;
  viewedAt: string;
}

export function useRecentlyViewed() {
  // Get recently viewed items for current user
  const getRecentlyViewed = (userId?: string): RecentlyViewedItem[] => {
    try {
      const key = userId ? `${STORAGE_KEY}_${userId}` : `${STORAGE_KEY}_guest`;
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      
      const items: RecentlyViewedItem[] = JSON.parse(stored);
      // Sort by most recently viewed
      return items.sort((a, b) => 
        new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()
      );
    } catch (error) {
      console.error('Error loading recently viewed:', error);
      return [];
    }
  };

  // Add product to recently viewed
  const addToRecentlyViewed = (product: Product, userId?: string) => {
    try {
      const key = userId ? `${STORAGE_KEY}_${userId}` : `${STORAGE_KEY}_guest`;
      const existing = getRecentlyViewed(userId);
      
      // Remove if already exists
      const filtered = existing.filter(item => item.id !== product.id);
      
      // Add to beginning
      const newItem: RecentlyViewedItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.images && product.images.length > 0 ? product.images[0] : undefined,
        category: product.category,
        viewedAt: new Date().toISOString(),
      };
      
      const updated = [newItem, ...filtered].slice(0, MAX_RECENTLY_VIEWED);
      localStorage.setItem(key, JSON.stringify(updated));
      
      console.log('✅ Added to recently viewed:', product.name);
    } catch (error) {
      console.error('Error adding to recently viewed:', error);
    }
  };

  // Clear recently viewed
  const clearRecentlyViewed = (userId?: string) => {
    try {
      const key = userId ? `${STORAGE_KEY}_${userId}` : `${STORAGE_KEY}_guest`;
      localStorage.removeItem(key);
      console.log('🗑️ Cleared recently viewed');
    } catch (error) {
      console.error('Error clearing recently viewed:', error);
    }
  };

  return {
    getRecentlyViewed,
    addToRecentlyViewed,
    clearRecentlyViewed,
  };
}
