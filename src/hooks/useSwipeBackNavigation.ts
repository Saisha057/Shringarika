import { useEffect, useRef } from 'react';

interface TouchPosition {
  x: number;
  y: number;
  time: number;
}

/**
 * Custom hook to enable two-finger swipe-back navigation on all pages
 * 
 * Features:
 * - Detects two-finger horizontal swipe from left to right
 * - Navigates to previous page in browser history
 * - Prevents page jumping to footer or other unwanted scrolling
 * - Works on ALL pages without specific configuration
 * 
 * Usage: Simply call useSwipeBackNavigation() in your root App component
 */
export function useSwipeBackNavigation() {
  const touchStartRef = useRef<TouchPosition | null>(null);
  const isTwoFingerRef = useRef<boolean>(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Check if this is a two-finger gesture
      if (e.touches.length === 2) {
        isTwoFingerRef.current = true;
        
        // Calculate center point between two fingers
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        touchStartRef.current = {
          x: centerX,
          y: centerY,
          time: Date.now()
        };
      } else {
        isTwoFingerRef.current = false;
        touchStartRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Only process if we have a two-finger start position
      if (!isTwoFingerRef.current || !touchStartRef.current || e.touches.length !== 2) {
        return;
      }

      // Calculate current center point between two fingers
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const deltaX = centerX - touchStartRef.current.x;
      const deltaY = centerY - touchStartRef.current.y;
      
      // Check if this is a horizontal swipe (more horizontal than vertical)
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
      
      // Check if swipe is from left to right (positive deltaX)
      const isRightSwipe = deltaX > 0;
      
      // Minimum swipe distance to trigger navigation (in pixels)
      const minSwipeDistance = 50;
      
      // If horizontal right swipe exceeds threshold, prevent default behavior
      if (isHorizontal && isRightSwipe && Math.abs(deltaX) > minSwipeDistance) {
        // Prevent default scrolling/overscroll behavior that causes page jumps
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Only process if we had a two-finger gesture
      if (!isTwoFingerRef.current || !touchStartRef.current) {
        isTwoFingerRef.current = false;
        touchStartRef.current = null;
        return;
      }

      // Get the final touch position (use changedTouches since touches are released)
      if (e.changedTouches.length >= 2) {
        const centerX = (e.changedTouches[0].clientX + e.changedTouches[1].clientX) / 2;
        const centerY = (e.changedTouches[0].clientY + e.changedTouches[1].clientY) / 2;

        const deltaX = centerX - touchStartRef.current.x;
        const deltaY = centerY - touchStartRef.current.y;
        const deltaTime = Date.now() - touchStartRef.current.time;

        // Swipe parameters
        const minSwipeDistance = 80; // Minimum pixels to trigger
        const maxSwipeTime = 500; // Maximum time for a valid swipe (ms)
        const minSwipeVelocity = 0.3; // Minimum velocity (pixels/ms)

        // Calculate swipe velocity
        const velocity = Math.abs(deltaX) / deltaTime;

        // Check if this is a valid horizontal right swipe
        const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.5; // More horizontal than vertical
        const isRightSwipe = deltaX > minSwipeDistance;
        const isFastEnough = velocity > minSwipeVelocity;
        const isQuickEnough = deltaTime < maxSwipeTime;

        if (isHorizontal && isRightSwipe && isFastEnough && isQuickEnough) {
          // Navigate back using browser history API
          // This goes to the immediately previous page only
          window.history.back();
          
          console.log('🔙 Two-finger swipe detected - navigating back', {
            deltaX: deltaX.toFixed(0),
            deltaY: deltaY.toFixed(0),
            velocity: velocity.toFixed(2),
            time: deltaTime
          });
        }
      }

      // Reset state
      isTwoFingerRef.current = false;
      touchStartRef.current = null;
    };

    const handleTouchCancel = () => {
      // Reset state if touch is cancelled
      isTwoFingerRef.current = false;
      touchStartRef.current = null;
    };

    // Add event listeners with passive: false to allow preventDefault
    // This is important to prevent default scroll behavior
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    // Cleanup listeners on unmount
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, []);

  // Also prevent overscroll-behavior that causes page jumps to footer
  useEffect(() => {
    // Add CSS to prevent overscroll
    const style = document.createElement('style');
    style.textContent = `
      html, body {
        overscroll-behavior-x: none;
        overscroll-behavior-y: auto;
      }
      
      /* Prevent horizontal overscroll on all containers */
      * {
        overscroll-behavior-x: none;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);
}
