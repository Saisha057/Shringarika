import compression from 'compression';

/**
 * Compression middleware with custom configuration
 * Compresses responses to reduce bandwidth and improve load times
 */

// Custom compression filter
const shouldCompress = (req, res) => {
  // Don't compress if client doesn't support it
  if (req.headers['x-no-compression']) {
    return false;
  }

  // Use compression's default filter function
  return compression.filter(req, res);
};

// Compression middleware with optimal settings
export const compressionMiddleware = compression({
  // Compression level (0-9): 6 is a good balance between speed and compression
  level: 6,
  
  // Compress responses with these MIME types
  filter: shouldCompress,
  
  // Minimum response size to compress (in bytes)
  threshold: 1024, // 1KB
  
  // Memory level (1-9): affects compression quality and memory usage
  memLevel: 8,
  
  // Compression strategy
  strategy: compression.Z_DEFAULT_STRATEGY,
});

/**
 * Response size logger middleware
 * Logs the size of responses before and after compression
 */
export const responseLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override res.end to log response size
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    // Calculate response size
    let responseSize = 0;
    if (chunk) {
      responseSize = Buffer.isBuffer(chunk) 
        ? chunk.length 
        : Buffer.byteLength(chunk, encoding);
    }
    
    // Log response info
    const sizeKB = (responseSize / 1024).toFixed(2);
    const compressionRatio = res.getHeader('content-encoding') 
      ? ' (compressed)' 
      : '';
    
    console.log(
      `📊 ${req.method} ${req.originalUrl} - ` +
      `${res.statusCode} - ${sizeKB}KB${compressionRatio} - ${duration}ms`
    );
    
    // Call original end
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

export default { compressionMiddleware, responseLogger };
