import { getSupabaseAdmin } from '../config/supabase.js';
import { format } from '@fast-csv/format';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temp export directory
const EXPORT_DIR = path.join(__dirname, '..', 'exports');

/**
 * Ensure export directory exists
 */
async function ensureExportDirectory() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

/**
 * Export orders to CSV or PDF
 * @param {Object} options - Export options
 * @param {string} options.format - 'csv' or 'pdf'
 * @param {string} options.startDate - Start date filter
 * @param {string} options.endDate - End date filter
 * @param {string} options.status - Order status filter
 * @returns {Promise<Object>} Export file details
 */
export async function exportOrders({ format = 'csv', startDate, endDate, status } = {}) {
  try {
    await ensureExportDirectory();
    const supabase = getSupabaseAdmin();

    // Build query
    let query = supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey(name, email),
        order_items(*, products(name, sku))
      `);

    // Apply filters
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data: orders, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }

    if (!orders || orders.length === 0) {
      throw new Error('No orders found matching the criteria');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `orders_export_${timestamp}.${format}`;
    const filePath = path.join(EXPORT_DIR, filename);

    if (format === 'csv') {
      return await exportOrdersToCSV(orders, filePath, filename);
    } else if (format === 'pdf') {
      return await exportOrdersToPDF(orders, filePath, filename);
    } else {
      throw new Error('Invalid export format. Use "csv" or "pdf"');
    }
  } catch (error) {
    console.error('Error exporting orders:', error);
    throw new Error(`Failed to export orders: ${error.message}`);
  }
}

/**
 * Export orders to CSV
 */
async function exportOrdersToCSV(orders, filePath, filename) {
  return new Promise((resolve, reject) => {
    const stream = format({ headers: true });
    const writeStream = fs.createWriteStream(filePath);

    writeStream.on('finish', () => {
      resolve({
        success: true,
        filename,
        filePath,
        format: 'csv',
        recordCount: orders.length,
        mimeType: 'text/csv'
      });
    });

    writeStream.on('error', reject);

    stream.pipe(writeStream);

    // Write rows
    orders.forEach(order => {
      const itemsCount = order.order_items?.length || 0;
      const itemsTotal = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

      stream.write({
        'Order ID': order.id,
        'Order Number': order.order_number || 'N/A',
        'Customer Name': order.users?.name || 'N/A',
        'Customer Email': order.users?.email || 'N/A',
        'Status': order.status,
        'Payment Status': order.payment_status,
        'Payment Method': order.payment_method,
        'Total Amount': order.total_amount,
        'Items Count': itemsCount,
        'Total Items': itemsTotal,
        'Shipping Address': order.shipping_address ? JSON.stringify(order.shipping_address) : 'N/A',
        'Created At': new Date(order.created_at).toLocaleString(),
        'Updated At': new Date(order.updated_at).toLocaleString()
      });
    });

    stream.end();
  });
}

/**
 * Export orders to PDF
 */
async function exportOrdersToPDF(orders, filePath, filename) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);

    stream.on('finish', () => {
      resolve({
        success: true,
        filename,
        filePath,
        format: 'pdf',
        recordCount: orders.length,
        mimeType: 'application/pdf'
      });
    });

    stream.on('error', reject);

    doc.pipe(stream);

    // Title
    doc.fontSize(20).text('Orders Report', { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Summary
    const totalAmount = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
    doc.fontSize(12).text(`Total Orders: ${orders.length}`);
    doc.text(`Total Amount: $${totalAmount.toFixed(2)}`);
    doc.moveDown();

    // Orders table
    orders.forEach((order, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.fontSize(10).text(`${index + 1}. Order #${order.order_number || order.id.substring(0, 8)}`);
      doc.fontSize(8);
      doc.text(`Customer: ${order.users?.name || 'N/A'} (${order.users?.email || 'N/A'})`);
      doc.text(`Status: ${order.status} | Payment: ${order.payment_status}`);
      doc.text(`Amount: $${order.total_amount} | Items: ${order.order_items?.length || 0}`);
      doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`);
      doc.moveDown(0.5);
    });

    doc.end();
  });
}

/**
 * Export users to CSV or PDF
 * @param {Object} options - Export options
 * @param {string} options.format - 'csv' or 'pdf'
 * @param {string} options.role - User role filter
 * @param {boolean} options.isActive - Active status filter
 * @returns {Promise<Object>} Export file details
 */
export async function exportUsers({ format = 'csv', role, isActive } = {}) {
  try {
    await ensureExportDirectory();
    const supabase = getSupabaseAdmin();

    // Build query
    let query = supabase
      .from('users')
      .select('id, name, email, phone, role, is_active, created_at, updated_at');

    // Apply filters
    if (role) {
      query = query.eq('role', role);
    }
    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    query = query.order('created_at', { ascending: false });

    const { data: users, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    if (!users || users.length === 0) {
      throw new Error('No users found matching the criteria');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `users_export_${timestamp}.${format}`;
    const filePath = path.join(EXPORT_DIR, filename);

    if (format === 'csv') {
      return await exportUsersToCSV(users, filePath, filename);
    } else if (format === 'pdf') {
      return await exportUsersToPDF(users, filePath, filename);
    } else {
      throw new Error('Invalid export format. Use "csv" or "pdf"');
    }
  } catch (error) {
    console.error('Error exporting users:', error);
    throw new Error(`Failed to export users: ${error.message}`);
  }
}

/**
 * Export users to CSV
 */
async function exportUsersToCSV(users, filePath, filename) {
  return new Promise((resolve, reject) => {
    const stream = format({ headers: true });
    const writeStream = fs.createWriteStream(filePath);

    writeStream.on('finish', () => {
      resolve({
        success: true,
        filename,
        filePath,
        format: 'csv',
        recordCount: users.length,
        mimeType: 'text/csv'
      });
    });

    writeStream.on('error', reject);

    stream.pipe(writeStream);

    users.forEach(user => {
      stream.write({
        'User ID': user.id,
        'Name': user.name,
        'Email': user.email,
        'Phone': user.phone || 'N/A',
        'Role': user.role || 'user',
        'Status': user.is_active ? 'Active' : 'Inactive',
        'Registered': new Date(user.created_at).toLocaleString(),
        'Last Updated': new Date(user.updated_at).toLocaleString()
      });
    });

    stream.end();
  });
}

/**
 * Export users to PDF
 */
async function exportUsersToPDF(users, filePath, filename) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);

    stream.on('finish', () => {
      resolve({
        success: true,
        filename,
        filePath,
        format: 'pdf',
        recordCount: users.length,
        mimeType: 'application/pdf'
      });
    });

    stream.on('error', reject);

    doc.pipe(stream);

    // Title
    doc.fontSize(20).text('Users Report', { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Summary
    const activeUsers = users.filter(u => u.is_active).length;
    doc.fontSize(12).text(`Total Users: ${users.length}`);
    doc.text(`Active Users: ${activeUsers}`);
    doc.text(`Inactive Users: ${users.length - activeUsers}`);
    doc.moveDown();

    // Users table
    users.forEach((user, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.fontSize(10).text(`${index + 1}. ${user.name}`);
      doc.fontSize(8);
      doc.text(`Email: ${user.email} | Phone: ${user.phone || 'N/A'}`);
      doc.text(`Role: ${user.role || 'user'} | Status: ${user.is_active ? 'Active' : 'Inactive'}`);
      doc.text(`Registered: ${new Date(user.created_at).toLocaleString()}`);
      doc.moveDown(0.5);
    });

    doc.end();
  });
}

/**
 * Export products to CSV or PDF
 * @param {Object} options - Export options
 * @param {string} options.format - 'csv' or 'pdf'
 * @param {string} options.category - Category filter
 * @param {boolean} options.inStock - Stock filter
 * @returns {Promise<Object>} Export file details
 */
export async function exportProducts({ format = 'csv', category, inStock } = {}) {
  try {
    await ensureExportDirectory();
    const supabase = getSupabaseAdmin();

    // Build query
    let query = supabase
      .from('products')
      .select('*');

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    if (inStock !== undefined) {
      if (inStock) {
        query = query.gt('stock_quantity', 0);
      } else {
        query = query.eq('stock_quantity', 0);
      }
    }

    query = query.order('name', { ascending: true });

    const { data: products, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    if (!products || products.length === 0) {
      throw new Error('No products found matching the criteria');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `products_export_${timestamp}.${format}`;
    const filePath = path.join(EXPORT_DIR, filename);

    if (format === 'csv') {
      return await exportProductsToCSV(products, filePath, filename);
    } else if (format === 'pdf') {
      return await exportProductsToPDF(products, filePath, filename);
    } else {
      throw new Error('Invalid export format. Use "csv" or "pdf"');
    }
  } catch (error) {
    console.error('Error exporting products:', error);
    throw new Error(`Failed to export products: ${error.message}`);
  }
}

/**
 * Export products to CSV
 */
async function exportProductsToCSV(products, filePath, filename) {
  return new Promise((resolve, reject) => {
    const stream = format({ headers: true });
    const writeStream = fs.createWriteStream(filePath);

    writeStream.on('finish', () => {
      resolve({
        success: true,
        filename,
        filePath,
        format: 'csv',
        recordCount: products.length,
        mimeType: 'text/csv'
      });
    });

    writeStream.on('error', reject);

    stream.pipe(writeStream);

    products.forEach(product => {
      stream.write({
        'Product ID': product.id,
        'Name': product.name,
        'SKU': product.sku || 'N/A',
        'Category': product.category,
        'Price': product.price,
        'Stock': product.stock_quantity,
        'Status': product.stock_quantity > 0 ? 'In Stock' : 'Out of Stock',
        'Description': product.description?.substring(0, 100) || 'N/A',
        'Created': new Date(product.created_at).toLocaleString(),
        'Updated': new Date(product.updated_at).toLocaleString()
      });
    });

    stream.end();
  });
}

/**
 * Export products to PDF
 */
async function exportProductsToPDF(products, filePath, filename) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);

    stream.on('finish', () => {
      resolve({
        success: true,
        filename,
        filePath,
        format: 'pdf',
        recordCount: products.length,
        mimeType: 'application/pdf'
      });
    });

    stream.on('error', reject);

    doc.pipe(stream);

    // Title
    doc.fontSize(20).text('Products Report', { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Summary
    const totalValue = products.reduce((sum, p) => sum + (parseFloat(p.price || 0) * (p.stock_quantity || 0)), 0);
    const inStock = products.filter(p => p.stock_quantity > 0).length;
    doc.fontSize(12).text(`Total Products: ${products.length}`);
    doc.text(`In Stock: ${inStock} | Out of Stock: ${products.length - inStock}`);
    doc.text(`Total Inventory Value: $${totalValue.toFixed(2)}`);
    doc.moveDown();

    // Products table
    products.forEach((product, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.fontSize(10).text(`${index + 1}. ${product.name}`);
      doc.fontSize(8);
      doc.text(`SKU: ${product.sku || 'N/A'} | Category: ${product.category}`);
      doc.text(`Price: $${product.price} | Stock: ${product.stock_quantity}`);
      doc.text(`Status: ${product.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}`);
      doc.moveDown(0.5);
    });

    doc.end();
  });
}

/**
 * Export analytics data to CSV or PDF
 * @param {Object} options - Export options
 * @param {string} options.format - 'csv' or 'pdf'
 * @param {string} options.type - 'sales' | 'users' | 'products'
 * @param {string} options.startDate - Start date
 * @param {string} options.endDate - End date
 * @returns {Promise<Object>} Export file details
 */
export async function exportAnalytics({ format = 'csv', type = 'sales', startDate, endDate } = {}) {
  try {
    await ensureExportDirectory();
    const supabase = getSupabaseAdmin();

    let data;
    let headers;
    let title;

    if (type === 'sales') {
      // Get sales data
      let query = supabase
        .from('orders')
        .select('*');

      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data: orders, error } = await query.order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      data = orders;
      title = 'Sales Analytics';
    } else if (type === 'users') {
      // Get users data
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      data = users;
      title = 'Users Analytics';
    } else if (type === 'products') {
      // Get products data
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw new Error(error.message);

      data = products;
      title = 'Products Analytics';
    } else {
      throw new Error('Invalid analytics type');
    }

    if (!data || data.length === 0) {
      throw new Error('No data found');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analytics_${type}_${timestamp}.${format}`;
    const filePath = path.join(EXPORT_DIR, filename);

    if (format === 'csv') {
      return await exportDataToCSV(data, filePath, filename);
    } else if (format === 'pdf') {
      return await exportDataToPDF(data, filePath, filename, title);
    } else {
      throw new Error('Invalid export format');
    }
  } catch (error) {
    console.error('Error exporting analytics:', error);
    throw new Error(`Failed to export analytics: ${error.message}`);
  }
}

/**
 * Generic CSV export
 */
async function exportDataToCSV(data, filePath, filename) {
  return new Promise((resolve, reject) => {
    const stream = format({ headers: true });
    const writeStream = fs.createWriteStream(filePath);

    writeStream.on('finish', () => {
      resolve({
        success: true,
        filename,
        filePath,
        format: 'csv',
        recordCount: data.length,
        mimeType: 'text/csv'
      });
    });

    writeStream.on('error', reject);

    stream.pipe(writeStream);

    data.forEach(row => {
      stream.write(row);
    });

    stream.end();
  });
}

/**
 * Generic PDF export
 */
async function exportDataToPDF(data, filePath, filename, title) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);

    stream.on('finish', () => {
      resolve({
        success: true,
        filename,
        filePath,
        format: 'pdf',
        recordCount: data.length,
        mimeType: 'application/pdf'
      });
    });

    stream.on('error', reject);

    doc.pipe(stream);

    // Title
    doc.fontSize(20).text(title, { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Data summary
    doc.fontSize(12).text(`Total Records: ${data.length}`);
    doc.moveDown();

    // Data
    data.slice(0, 100).forEach((item, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.fontSize(8);
      doc.text(`${index + 1}. ${JSON.stringify(item).substring(0, 200)}...`);
      doc.moveDown(0.3);
    });

    if (data.length > 100) {
      doc.text(`... and ${data.length - 100} more records`);
    }

    doc.end();
  });
}

/**
 * Cleanup old export files
 * @param {number} hoursOld - Delete files older than this many hours
 * @returns {Promise<Object>} Cleanup result
 */
export async function cleanupOldExports(hoursOld = 24) {
  try {
    await ensureExportDirectory();

    const files = fs.readdirSync(EXPORT_DIR);
    const now = Date.now();
    const maxAge = hoursOld * 60 * 60 * 1000;

    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(EXPORT_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    return {
      success: true,
      message: `Deleted ${deletedCount} old export files`,
      deleted_count: deletedCount
    };
  } catch (error) {
    console.error('Error cleaning up old exports:', error);
    throw new Error(`Failed to cleanup old exports: ${error.message}`);
  }
}
