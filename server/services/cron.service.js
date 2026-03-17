import cron from 'node-cron';
import { getSupabaseAdmin } from '../config/supabase.js';
import { createBackup, cleanupOldBackups } from './backup.service.js';
import { cleanupOldExports } from './export.service.js';
import { cleanupOldLogs } from './auditLogs.service.js';
import { sendEmail } from './email.service.js';

// Store active cron jobs
const activeCronJobs = {};

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  console.log('\n🕐 === INITIALIZING CRON JOBS === 🕐');

  try {
    // Daily Sales Report - Every day at 9 AM
    if (process.env.CRON_DAILY_REPORT !== 'false') {
      activeCronJobs.dailySalesReport = cron.schedule('0 9 * * *', async () => {
        console.log('Running daily sales report...');
        await generateDailySalesReport();
      });
      console.log('✅ Daily Sales Report: Scheduled (9 AM daily)');
    }

    // Weekly Analytics - Every Monday at 9 AM
    if (process.env.CRON_WEEKLY_ANALYTICS !== 'false') {
      activeCronJobs.weeklyAnalytics = cron.schedule('0 9 * * 1', async () => {
        console.log('Running weekly analytics...');
        await generateWeeklyAnalytics();
      });
      console.log('✅ Weekly Analytics: Scheduled (Monday 9 AM)');
    }

    // Monthly Backup - 1st day of month at 2 AM
    if (process.env.CRON_MONTHLY_BACKUP !== 'false') {
      activeCronJobs.monthlyBackup = cron.schedule('0 2 1 * *', async () => {
        console.log('Running monthly backup...');
        await performMonthlyBackup();
      });
      console.log('✅ Monthly Backup: Scheduled (1st day, 2 AM)');
    }

    // Abandoned Cart Reminder - Every 6 hours
    if (process.env.CRON_ABANDONED_CART !== 'false') {
      activeCronJobs.abandonedCart = cron.schedule('0 */6 * * *', async () => {
        console.log('Checking abandoned carts...');
        await sendAbandonedCartReminders();
      });
      console.log('✅ Abandoned Cart Reminders: Scheduled (Every 6 hours)');
    }

    // Low Stock Alerts - Every day at 10 AM
    if (process.env.CRON_LOW_STOCK !== 'false') {
      activeCronJobs.lowStockAlerts = cron.schedule('0 10 * * *', async () => {
        console.log('Checking low stock products...');
        await sendLowStockAlerts();
      });
      console.log('✅ Low Stock Alerts: Scheduled (10 AM daily)');
    }

    // Cleanup Audit Logs - Every Sunday at 3 AM
    if (process.env.CRON_CLEANUP_LOGS !== 'false') {
      activeCronJobs.cleanupLogs = cron.schedule('0 3 * * 0', async () => {
        console.log('Cleaning up old audit logs...');
        await performLogsCleanup();
      });
      console.log('✅ Audit Logs Cleanup: Scheduled (Sunday 3 AM)');
    }

    // Cleanup Old Exports - Every day at 4 AM
    if (process.env.CRON_CLEANUP_EXPORTS !== 'false') {
      activeCronJobs.cleanupExports = cron.schedule('0 4 * * *', async () => {
        console.log('Cleaning up old exports...');
        await performExportsCleanup();
      });
      console.log('✅ Exports Cleanup: Scheduled (4 AM daily)');
    }

    // Cleanup Old Backups - Every Sunday at 4 AM
    if (process.env.CRON_CLEANUP_BACKUPS !== 'false') {
      activeCronJobs.cleanupBackups = cron.schedule('0 4 * * 0', async () => {
        console.log('Cleaning up old backups...');
        await performBackupsCleanup();
      });
      console.log('✅ Backups Cleanup: Scheduled (Sunday 4 AM)');
    }

    // Update Order Status - Every hour
    if (process.env.CRON_ORDER_STATUS !== 'false') {
      activeCronJobs.orderStatus = cron.schedule('0 * * * *', async () => {
        console.log('Updating order statuses...');
        await updateOrderStatuses();
      });
      console.log('✅ Order Status Updates: Scheduled (Every hour)');
    }

    console.log(`\n✅ Total Cron Jobs Initialized: ${Object.keys(activeCronJobs).length}`);
    console.log('==========================================\n');

    return {
      success: true,
      count: Object.keys(activeCronJobs).length,
      jobs: Object.keys(activeCronJobs)
    };
  } catch (error) {
    console.error('❌ Error initializing cron jobs:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate daily sales report
 */
async function generateDailySalesReport() {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's orders
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    if (error) throw error;

    const totalOrders = orders?.length || 0;
    const totalRevenue = orders?.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0) || 0;
    const completedOrders = orders?.filter(o => o.status === 'delivered').length || 0;

    // Get admin users to send report
    const { data: admins, error: adminsError } = await supabase
      .from('users')
      .select('email, name')
      .in('role', ['admin', 'super_admin']);

    if (adminsError) throw adminsError;

    // Send email to each admin
    for (const admin of admins || []) {
      await sendEmail({
        to: admin.email,
        subject: `Daily Sales Report - ${today.toLocaleDateString()}`,
        html: `
          <h2>Daily Sales Report</h2>
          <p><strong>Date:</strong> ${today.toLocaleDateString()}</p>
          <ul>
            <li><strong>Total Orders:</strong> ${totalOrders}</li>
            <li><strong>Completed Orders:</strong> ${completedOrders}</li>
            <li><strong>Total Revenue:</strong> $${totalRevenue.toFixed(2)}</li>
            <li><strong>Average Order Value:</strong> $${totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0}</li>
          </ul>
          <p>Have a great day!</p>
        `
      });
    }

    console.log(`✅ Daily sales report sent to ${admins?.length || 0} admins`);
  } catch (error) {
    console.error('Error generating daily sales report:', error);
  }
}

/**
 * Generate weekly analytics
 */
async function generateWeeklyAnalytics() {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get weekly orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', weekAgo.toISOString())
      .lt('created_at', today.toISOString());

    if (ordersError) throw ordersError;

    // Get new users this week
    const { data: newUsers, error: usersError } = await supabase
      .from('users')
      .select('id')
      .gte('created_at', weekAgo.toISOString())
      .lt('created_at', today.toISOString());

    if (usersError) throw usersError;

    const totalOrders = orders?.length || 0;
    const totalRevenue = orders?.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0) || 0;
    const newUsersCount = newUsers?.length || 0;

    // Get admin users
    const { data: admins, error: adminsError } = await supabase
      .from('users')
      .select('email, name')
      .in('role', ['admin', 'super_admin']);

    if (adminsError) throw adminsError;

    // Send email to each admin
    for (const admin of admins || []) {
      await sendEmail({
        to: admin.email,
        subject: `Weekly Analytics Report - ${weekAgo.toLocaleDateString()} to ${today.toLocaleDateString()}`,
        html: `
          <h2>Weekly Analytics Report</h2>
          <p><strong>Period:</strong> ${weekAgo.toLocaleDateString()} - ${today.toLocaleDateString()}</p>
          <h3>Sales Performance</h3>
          <ul>
            <li><strong>Total Orders:</strong> ${totalOrders}</li>
            <li><strong>Total Revenue:</strong> $${totalRevenue.toFixed(2)}</li>
            <li><strong>Average Daily Revenue:</strong> $${(totalRevenue / 7).toFixed(2)}</li>
          </ul>
          <h3>User Growth</h3>
          <ul>
            <li><strong>New Users:</strong> ${newUsersCount}</li>
            <li><strong>Average Daily Signups:</strong> ${(newUsersCount / 7).toFixed(1)}</li>
          </ul>
          <p>Keep up the great work!</p>
        `
      });
    }

    console.log(`✅ Weekly analytics sent to ${admins?.length || 0} admins`);
  } catch (error) {
    console.error('Error generating weekly analytics:', error);
  }
}

/**
 * Perform monthly backup
 */
async function performMonthlyBackup() {
  try {
    const result = await createBackup({
      createdBy: 'system',
      backupType: 'full',
      metadata: {
        scheduled: true,
        type: 'monthly_automatic'
      }
    });

    console.log('✅ Monthly backup completed:', result.backup.filename);
  } catch (error) {
    console.error('Error performing monthly backup:', error);
  }
}

/**
 * Send abandoned cart reminders
 */
async function sendAbandonedCartReminders() {
  try {
    const supabase = getSupabaseAdmin();
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Get cart items updated 6 hours ago but not in the last day (to avoid spam)
    const { data: carts, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        users!cart_items_user_id_fkey(id, email, name),
        products!cart_items_product_id_fkey(name, price, image_url)
      `)
      .gte('updated_at', oneDayAgo.toISOString())
      .lte('updated_at', sixHoursAgo.toISOString());

    if (error) throw error;

    // Group by user
    const userCarts = {};
    carts?.forEach(item => {
      const userId = item.user_id;
      if (!userCarts[userId]) {
        userCarts[userId] = {
          user: item.users,
          items: []
        };
      }
      userCarts[userId].items.push(item);
    });

    // Send reminder to each user
    let sentCount = 0;
    for (const userId in userCarts) {
      const { user, items } = userCarts[userId];
      const totalValue = items.reduce((sum, item) => sum + (parseFloat(item.products?.price || 0) * item.quantity), 0);

      await sendEmail({
        to: user.email,
        subject: 'Don\'t forget your cart! 🛒',
        html: `
          <h2>Hi ${user.name}!</h2>
          <p>You left ${items.length} item(s) in your cart worth $${totalValue.toFixed(2)}.</p>
          <p>Complete your purchase now before items go out of stock!</p>
          <a href="${process.env.FRONTEND_URL}/cart" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Cart</a>
        `
      });

      sentCount++;
    }

    console.log(`✅ Sent ${sentCount} abandoned cart reminders`);
  } catch (error) {
    console.error('Error sending abandoned cart reminders:', error);
  }
}

/**
 * Send low stock alerts
 */
async function sendLowStockAlerts() {
  try {
    const supabase = getSupabaseAdmin();
    const lowStockThreshold = parseInt(process.env.LOW_STOCK_THRESHOLD || '10');

    // Get low stock products
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .lte('stock_quantity', lowStockThreshold)
      .gt('stock_quantity', 0);

    if (error) throw error;

    if (!products || products.length === 0) {
      console.log('✅ No low stock products found');
      return;
    }

    // Get admin users
    const { data: admins, error: adminsError } = await supabase
      .from('users')
      .select('email, name')
      .in('role', ['admin', 'super_admin', 'manager']);

    if (adminsError) throw adminsError;

    const productsList = products.map(p => 
      `<li><strong>${p.name}</strong> (SKU: ${p.sku || 'N/A'}): ${p.stock_quantity} units remaining</li>`
    ).join('');

    // Send alert to admins
    for (const admin of admins || []) {
      await sendEmail({
        to: admin.email,
        subject: `⚠️ Low Stock Alert - ${products.length} Products`,
        html: `
          <h2>Low Stock Alert</h2>
          <p>The following products are running low on stock:</p>
          <ul>
            ${productsList}
          </ul>
          <p>Please restock these items as soon as possible.</p>
        `
      });
    }

    console.log(`✅ Sent low stock alerts for ${products.length} products to ${admins?.length || 0} admins`);
  } catch (error) {
    console.error('Error sending low stock alerts:', error);
  }
}

/**
 * Cleanup old audit logs
 */
async function performLogsCleanup() {
  try {
    const daysOld = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90');
    const result = await cleanupOldLogs(daysOld);
    console.log(`✅ Cleaned up audit logs: ${result.deleted_count} logs deleted`);
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
  }
}

/**
 * Cleanup old exports
 */
async function performExportsCleanup() {
  try {
    const hoursOld = parseInt(process.env.EXPORT_RETENTION_HOURS || '24');
    const result = await cleanupOldExports(hoursOld);
    console.log(`✅ Cleaned up exports: ${result.deleted_count} files deleted`);
  } catch (error) {
    console.error('Error cleaning up exports:', error);
  }
}

/**
 * Cleanup old backups
 */
async function performBackupsCleanup() {
  try {
    const daysOld = parseInt(process.env.BACKUP_RETENTION_DAYS || '90');
    const result = await cleanupOldBackups(daysOld);
    console.log(`✅ Cleaned up backups: ${result.deleted_count} backups deleted`);
  } catch (error) {
    console.error('Error cleaning up backups:', error);
  }
}

/**
 * Update order statuses automatically
 */
async function updateOrderStatuses() {
  try {
    const supabase = getSupabaseAdmin();
    // Auto-complete delivered orders older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: deliveredOrders, error: deliveredError } = await supabase
      .from('orders')
      .update({ status: 'completed' })
      .eq('status', 'delivered')
      .lte('updated_at', sevenDaysAgo.toISOString())
      .select();

    if (deliveredError) throw deliveredError;

    console.log(`✅ Auto-completed ${deliveredOrders?.length || 0} delivered orders`);

    // Auto-cancel pending orders older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: pendingOrders, error: pendingError } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('status', 'pending')
      .lte('created_at', thirtyDaysAgo.toISOString())
      .select();

    if (pendingError) throw pendingError;

    console.log(`✅ Auto-cancelled ${pendingOrders?.length || 0} pending orders`);
  } catch (error) {
    console.error('Error updating order statuses:', error);
  }
}

/**
 * Stop all cron jobs
 */
export function stopAllCronJobs() {
  try {
    Object.values(activeCronJobs).forEach(job => {
      job.stop();
    });
    console.log('✅ All cron jobs stopped');
    return { success: true };
  } catch (error) {
    console.error('Error stopping cron jobs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get cron job status
 */
export function getCronJobStatus() {
  return {
    success: true,
    active_jobs: Object.keys(activeCronJobs).length,
    jobs: Object.keys(activeCronJobs)
  };
}
