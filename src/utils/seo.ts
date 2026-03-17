/**
 * SEO Helper Utilities
 * 
 * Generate meta tags, structured data, sitemaps
 */

export interface MetaTags {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
  noindex?: boolean;
}

export interface ProductSchema {
  name: string;
  description: string;
  image: string[];
  sku: string;
  brand: string;
  price: number;
  currency: string;
  availability: string;
  rating?: number;
  reviewCount?: number;
}

/**
 * Generate meta tags for SEO
 */
export const generateMetaTags = (tags: MetaTags): string => {
  const {
    title,
    description,
    keywords,
    ogImage,
    ogType = 'website',
    canonicalUrl,
    noindex = false
  } = tags;

  const siteName = 'SHRINGARIKA - Premium Ethnic Wear';
  const baseUrl = import.meta.env.VITE_BASE_URL || 'https://shringarika.com';
  const defaultImage = `${baseUrl}/og-image.jpg`;

  return `
    <title>${title} | ${siteName}</title>
    <meta name="description" content="${description}" />
    ${keywords ? `<meta name="keywords" content="${keywords}" />` : ''}
    ${noindex ? '<meta name="robots" content="noindex, nofollow" />' : '<meta name="robots" content="index, follow" />'}
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${ogType}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage || defaultImage}" />
    <meta property="og:url" content="${canonicalUrl || baseUrl}" />
    <meta property="og:site_name" content="${siteName}" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage || defaultImage}" />
    
    <!-- Canonical URL -->
    ${canonicalUrl ? `<link rel="canonical" href="${canonicalUrl}" />` : ''}
  `.trim();
};

/**
 * Generate Product Schema.org structured data
 */
export const generateProductSchema = (product: ProductSchema): string => {
  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: product.brand || 'SHRINGARIKA'
    },
    offers: {
      '@type': 'Offer',
      url: window.location.href,
      priceCurrency: product.currency,
      price: product.price,
      availability: `https://schema.org/${product.availability}`,
      priceValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  };

  if (product.rating && product.reviewCount) {
    (schema as any).aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount
    };
  }

  return JSON.stringify(schema, null, 2);
};

/**
 * Generate Breadcrumb Schema
 */
export const generateBreadcrumbSchema = (items: { name: string; url: string }[]): string => {
  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };

  return JSON.stringify(schema, null, 2);
};

/**
 * Generate Organization Schema
 */
export const generateOrganizationSchema = (): string => {
  const baseUrl = import.meta.env.VITE_BASE_URL || 'https://shringarika.com';
  
  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'Organization',
    name: 'SHRINGARIKA',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'Premium ethnic wear for modern women. Traditional elegance meets contemporary style.',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-XXX-XXX-XXXX',
      contactType: 'Customer Service',
      email: 'support@shringarika.com',
      availableLanguage: ['English', 'Hindi']
    },
    sameAs: [
      'https://www.facebook.com/shringarika',
      'https://www.instagram.com/shringarika',
      'https://www.twitter.com/shringarika'
    ]
  };

  return JSON.stringify(schema, null, 2);
};

/**
 * Update meta tags in document head
 */
export const updateMetaTags = (tags: MetaTags): void => {
  // Update title
  document.title = `${tags.title} | SHRINGARIKA`;

  // Update or create meta tags
  const updateOrCreateMeta = (name: string, content: string, property = false) => {
    const attr = property ? 'property' : 'name';
    let meta = document.querySelector(`meta[${attr}="${name}"]`);
    
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr, name);
      document.head.appendChild(meta);
    }
    
    meta.setAttribute('content', content);
  };

  // Basic meta tags
  updateOrCreateMeta('description', tags.description);
  if (tags.keywords) {
    updateOrCreateMeta('keywords', tags.keywords);
  }
  updateOrCreateMeta('robots', tags.noindex ? 'noindex, nofollow' : 'index, follow');

  // Open Graph tags
  updateOrCreateMeta('og:title', tags.title, true);
  updateOrCreateMeta('og:description', tags.description, true);
  updateOrCreateMeta('og:type', tags.ogType || 'website', true);
  if (tags.ogImage) {
    updateOrCreateMeta('og:image', tags.ogImage, true);
  }
  if (tags.canonicalUrl) {
    updateOrCreateMeta('og:url', tags.canonicalUrl, true);
  }

  // Twitter Card tags
  updateOrCreateMeta('twitter:title', tags.title);
  updateOrCreateMeta('twitter:description', tags.description);
  if (tags.ogImage) {
    updateOrCreateMeta('twitter:image', tags.ogImage);
  }

  // Canonical URL
  if (tags.canonicalUrl) {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', tags.canonicalUrl);
  }
};

/**
 * Inject structured data script
 */
export const injectStructuredData = (schema: string): void => {
  // Remove existing schema scripts
  const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
  existingScripts.forEach(script => script.remove());

  // Create new script
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = schema;
  document.head.appendChild(script);
};

/**
 * Generate sitemap data (to be sent to backend)
 */
export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export const generateSitemapData = (urls: SitemapUrl[]): string => {
  const baseUrl = import.meta.env.VITE_BASE_URL || 'https://shringarika.com';
  
  const urlset = urls.map(url => `
    <url>
      <loc>${url.loc.startsWith('http') ? url.loc : `${baseUrl}${url.loc}`}</loc>
      ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
      ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
      ${url.priority !== undefined ? `<priority>${url.priority}</priority>` : ''}
    </url>
  `).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlset}
</urlset>`;
};

/**
 * SEO-friendly URL slug generator
 */
export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-')  // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
};

/**
 * Preload critical resources
 */
export const preloadResource = (href: string, as: string): void => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  document.head.appendChild(link);
};

/**
 * Prefetch next page resources
 */
export const prefetchResource = (href: string): void => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
};
