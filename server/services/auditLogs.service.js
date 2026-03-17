/**
 * Audit Logs Service
 * Tracks all admin actions and system changes
 */

import { supabase } from '../config/supabase.js';

/**
 * Log an admin action
 * @param {Object} logData - Action details
 * @returns {Object} Success status
 */
export const logAction = async (logData) => {
  try {
    const {
      userId,
      userName,
      userEmail,
      action,
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      metadata,
    } = logData;

    const { data, error } = await supabase
      .from('audit_logs')
      .insert([
        {
          user_id: userId,
          user_name: userName,
          user_email: userEmail,
          action,
          entity_type: entityType,
          entity_id: entityId,
          old_values: oldValues ? JSON.stringify(oldValues) : null,
          new_values: newValues ? JSON.stringify(newValues) : null,
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error logging action:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get audit logs with filters
 * @param {Object} filters - Filter options
 * @returns {Object} Audit logs
 */
export const getAuditLogs = async (filters = {}) => {
  try {
    const {
      userId,
      action,
      entityType,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters;

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (action) {
      query = query.eq('action', action);
    }

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    // Parse JSON fields
    const logs = data.map(log => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    return {
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      },
    };
  } catch (error) {
    console.error('Error getting audit logs:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get audit log by ID
 * @param {String} logId - Log ID
 * @returns {Object} Audit log
 */
export const getAuditLogById = async (logId) => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('id', logId)
      .single();

    if (error) throw error;

    // Parse JSON fields
    const log = {
      ...data,
      old_values: data.old_values ? JSON.parse(data.old_values) : null,
      new_values: data.new_values ? JSON.parse(data.new_values) : null,
      metadata: data.metadata ? JSON.parse(data.metadata) : null,
    };

    return { success: true, data: log };
  } catch (error) {
    console.error('Error getting audit log:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get audit logs statistics
 * @param {Object} filters - Date range filters
 * @returns {Object} Audit statistics
 */
export const getAuditStatistics = async (filters = {}) => {
  try {
    const { startDate, endDate } = filters;

    let query = supabase
      .from('audit_logs')
      .select('action, entity_type, user_id, created_at');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate statistics
    const stats = {
      totalActions: data.length,
      actionsByType: {},
      actionsByEntity: {},
      actionsByUser: {},
      actionsOverTime: {},
    };

    data.forEach(log => {
      // By action type
      stats.actionsByType[log.action] = (stats.actionsByType[log.action] || 0) + 1;

      // By entity type
      stats.actionsByEntity[log.entity_type] = (stats.actionsByEntity[log.entity_type] || 0) + 1;

      // By user
      stats.actionsByUser[log.user_id] = (stats.actionsByUser[log.user_id] || 0) + 1;

      // By date
      const date = new Date(log.created_at).toISOString().slice(0, 10);
      stats.actionsOverTime[date] = (stats.actionsOverTime[date] || 0) + 1;
    });

    // Convert to arrays for easier consumption
    stats.actionsByType = Object.entries(stats.actionsByType)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    stats.actionsByEntity = Object.entries(stats.actionsByEntity)
      .map(([entity, count]) => ({ entity, count }))
      .sort((a, b) => b.count - a.count);

    stats.actionsByUser = Object.entries(stats.actionsByUser)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 users

    stats.actionsOverTime = Object.entries(stats.actionsOverTime)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error getting audit statistics:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get entity change history
 * @param {String} entityType - Entity type (product, order, user)
 * @param {String} entityId - Entity ID
 * @returns {Object} Change history
 */
export const getEntityHistory = async (entityType, entityId) => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Parse JSON fields
    const logs = data.map(log => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    return { success: true, data: logs };
  } catch (error) {
    console.error('Error getting entity history:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user activity logs
 * @param {String} userId - User ID
 * @param {Number} limit - Number of logs to return
 * @returns {Object} User activity logs
 */
export const getUserActivity = async (userId, limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Parse JSON fields
    const logs = data.map(log => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    return { success: true, data: logs };
  } catch (error) {
    console.error('Error getting user activity:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete old audit logs
 * @param {Number} daysOld - Delete logs older than this many days
 * @returns {Object} Success status
 */
export const cleanupOldLogs = async (daysOld = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select();

    if (error) throw error;

    return {
      success: true,
      data: {
        deletedCount: data.length,
        cutoffDate: cutoffDate.toISOString(),
      },
    };
  } catch (error) {
    console.error('Error cleaning up old logs:', error);
    return { success: false, error: error.message };
  }
};

export default {
  logAction,
  getAuditLogs,
  getAuditLogById,
  getAuditStatistics,
  getEntityHistory,
  getUserActivity,
  cleanupOldLogs,
};
