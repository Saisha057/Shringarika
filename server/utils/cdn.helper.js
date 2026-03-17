/**
 * CDN Helper for serving static assets
 * Provides utilities for serving images and static files through CDN
 */

const CDN_URL = process.env.CDN_URL || '';
const USE_CDN = process.env.USE_CDN === 'true';
const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`;

/**
 * Get CDN URL for an asset
 * @param {string} path - Asset path
 * @param {string} type - Asset type (image, video, etc.)
 * @returns {string} Full CDN URL
 */
export const getCDNUrl = (path, type = 'image') => {
  if (!path) return '';
  
  // If already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Use Cloudinary for images
  if (type === 'image' && process.env.CLOUDINARY_CLOUD_NAME) {
    // If path contains cloudinary URL, return as is
    if (path.includes('cloudinary')) {
      return path;
    }
    
    // If it's a cloudinary public_id
    if (!path.startsWith('/')) {
      return `${CLOUDINARY_BASE_URL}/image/upload/${path}`;
    }
  }
  
  // Use custom CDN if enabled
  if (USE_CDN && CDN_URL) {
    return `${CDN_URL}${path.startsWith('/') ? path : '/' + path}`;
  }
  
  // Fallback to local path
  return path;
};

/**
 * Get optimized image URL with transformations
 * @param {string} path - Image path or public_id
 * @param {object} options - Transformation options
 * @returns {string} Optimized image URL
 */
export const getOptimizedImageUrl = (path, options = {}) => {
  if (!path) return '';
  
  // If already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // Check if it's a Cloudinary URL and we need to add transformations
    if (path.includes('cloudinary.com') && Object.keys(options).length > 0) {
      return addCloudinaryTransformations(path, options);
    }
    return path;
  }
  
  // Default optimization options
  const defaults = {
    width: options.width || 'auto',
    quality: options.quality || 'auto',
    format: options.format || 'auto',
    crop: options.crop || 'scale',
  };
  
  const transformations = buildCloudinaryTransformations({ ...defaults, ...options });
  
  return `${CLOUDINARY_BASE_URL}/image/upload/${transformations}${path}`;
};

/**
 * Build Cloudinary transformation string
 * @param {object} options - Transformation options
 * @returns {string} Transformation string
 */
const buildCloudinaryTransformations = (options) => {
  const transformations = [];
  
  if (options.width) transformations.push(`w_${options.width}`);
  if (options.height) transformations.push(`h_${options.height}`);
  if (options.quality) transformations.push(`q_${options.quality}`);
  if (options.format) transformations.push(`f_${options.format}`);
  if (options.crop) transformations.push(`c_${options.crop}`);
  if (options.gravity) transformations.push(`g_${options.gravity}`);
  if (options.effect) transformations.push(`e_${options.effect}`);
  if (options.dpr) transformations.push(`dpr_${options.dpr}`);
  
  return transformations.length > 0 ? transformations.join(',') + '/' : '';
};

/**
 * Add transformations to existing Cloudinary URL
 * @param {string} url - Existing Cloudinary URL
 * @param {object} options - Transformation options
 * @returns {string} URL with transformations
 */
const addCloudinaryTransformations = (url, options) => {
  const transformations = buildCloudinaryTransformations(options);
  
  if (!transformations) return url;
  
  // Insert transformations after /upload/
  return url.replace('/upload/', `/upload/${transformations}`);
};

/**
 * Generate responsive image srcset
 * @param {string} path - Image path
 * @param {array} widths - Array of widths for responsive images
 * @returns {string} srcset string
 */
export const getResponsiveImageSrcSet = (path, widths = [320, 640, 768, 1024, 1280, 1536]) => {
  if (!path) return '';
  
  const srcset = widths.map(width => {
    const url = getOptimizedImageUrl(path, { width, quality: 'auto', format: 'auto' });
    return `${url} ${width}w`;
  }).join(', ');
  
  return srcset;
};

/**
 * Get thumbnail URL
 * @param {string} path - Image path
 * @param {object} options - Thumbnail options
 * @returns {string} Thumbnail URL
 */
export const getThumbnailUrl = (path, options = {}) => {
  return getOptimizedImageUrl(path, {
    width: options.width || 200,
    height: options.height || 200,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
    ...options
  });
};

/**
 * Preload critical images
 * @param {array} imagePaths - Array of image paths to preload
 * @returns {string} HTML link tags for preloading
 */
export const getPreloadLinks = (imagePaths = []) => {
  return imagePaths.map(path => {
    const url = getCDNUrl(path, 'image');
    return `<link rel="preload" as="image" href="${url}">`;
  }).join('\n');
};

/**
 * Image format detection and conversion
 */
export const ImageFormats = {
  WEBP: 'webp',
  AVIF: 'avif',
  AUTO: 'auto',
  JPEG: 'jpg',
  PNG: 'png',
};

export default {
  getCDNUrl,
  getOptimizedImageUrl,
  getResponsiveImageSrcSet,
  getThumbnailUrl,
  getPreloadLinks,
  ImageFormats
};
