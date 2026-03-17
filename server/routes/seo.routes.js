import express from 'express';
import { getSupabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * Generate XML Sitemap
 * @route GET /sitemap.xml
 * @access Public
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const baseUrl = process.env.FRONTEND_URL || 'https://shringarika.live';
    const today = new Date().toISOString().split('T')[0];

    // Static pages
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/products', priority: '0.9', changefreq: 'daily' },
      { url: '/about', priority: '0.7', changefreq: 'monthly' },
      { url: '/contact', priority: '0.7', changefreq: 'monthly' },
      { url: '/privacy-policy', priority: '0.5', changefreq: 'yearly' },
      { url: '/terms-of-service', priority: '0.5', changefreq: 'yearly' },
      { url: '/shipping-info', priority: '0.6', changefreq: 'monthly' },
    ];

    // Get all products
    const { data: products } = await supabase
      .from('products')
      .select('slug, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    // Get all categories
    const { data: categories } = await supabase
      .from('categories')
      .select('slug, updated_at')
      .eq('is_active', true);

    // Build sitemap XML
    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add static pages
    staticPages.forEach(page => {
      sitemap += `  <url>\n`;
      sitemap += `    <loc>${baseUrl}${page.url}</loc>\n`;
      sitemap += `    <lastmod>${today}</lastmod>\n`;
      sitemap += `    <changefreq>${page.changefreq}</changefreq>\n`;
      sitemap += `    <priority>${page.priority}</priority>\n`;
      sitemap += `  </url>\n`;
    });

    // Add products
    products?.forEach(product => {
      sitemap += `  <url>\n`;
      sitemap += `    <loc>${baseUrl}/products/${product.slug}</loc>\n`;
      sitemap += `    <lastmod>${product.updated_at?.split('T')[0] || today}</lastmod>\n`;
      sitemap += `    <changefreq>weekly</changefreq>\n`;
      sitemap += `    <priority>0.8</priority>\n`;
      sitemap += `  </url>\n`;
    });

    // Add categories
    categories?.forEach(category => {
      sitemap += `  <url>\n`;
      sitemap += `    <loc>${baseUrl}/category/${category.slug}</loc>\n`;
      sitemap += `    <lastmod>${category.updated_at?.split('T')[0] || today}</lastmod>\n`;
      sitemap += `    <changefreq>weekly</changefreq>\n`;
      sitemap += `    <priority>0.7</priority>\n`;
      sitemap += `  </url>\n`;
    });

    sitemap += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * Generate robots.txt
 * @route GET /robots.txt
 * @access Public
 */
router.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://shringarika.live';
  
  const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /account/
Disallow: /checkout/
Disallow: /cart/
Disallow: /search?

Sitemap: ${baseUrl}/sitemap.xml
`;

  res.header('Content-Type', 'text/plain');
  res.send(robots);
});

export default router;
