/**
 * Role-Based Access Control (RBAC) Service
 * Manages roles and permissions for admin users
 */

import { supabase } from '../config/supabase.js';

// Define role hierarchy
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPPORT: 'support',
  USER: 'user',
};

// Define permissions
export const PERMISSIONS = {
  // User management
  VIEW_USERS: 'view_users',
  CREATE_USERS: 'create_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',

  // Product management
  VIEW_PRODUCTS: 'view_products',
  CREATE_PRODUCTS: 'create_products',
  EDIT_PRODUCTS: 'edit_products',
  DELETE_PRODUCTS: 'delete_products',

  // Order management
  VIEW_ORDERS: 'view_orders',
  CREATE_ORDERS: 'create_orders',
  EDIT_ORDERS: 'edit_orders',
  DELETE_ORDERS: 'delete_orders',
  CANCEL_ORDERS: 'cancel_orders',

  // Analytics
  VIEW_ANALYTICS: 'view_analytics',
  EXPORT_DATA: 'export_data',

  // System
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_BACKUPS: 'manage_backups',
  BULK_OPERATIONS: 'bulk_operations',
};

// Role-Permission mapping
export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS), // All permissions

  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.CREATE_USERS,
    PERMISSIONS.EDIT_USERS,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.CREATE_PRODUCTS,
    PERMISSIONS.EDIT_PRODUCTS,
    PERMISSIONS.DELETE_PRODUCTS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.EDIT_ORDERS,
    PERMISSIONS.CANCEL_ORDERS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.BULK_OPERATIONS,
  ],

  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.EDIT_PRODUCTS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.EDIT_ORDERS,
    PERMISSIONS.CANCEL_ORDERS,
    PERMISSIONS.VIEW_ANALYTICS,
  ],

  [ROLES.SUPPORT]: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.EDIT_ORDERS,
  ],

  [ROLES.USER]: [],
};

/**
 * Check if a user has a specific permission
 * @param {String} userId - User ID
 * @param {String} permission - Permission to check
 * @returns {Boolean} Has permission
 */
export const hasPermission = async (userId, permission) => {
  try {
    // Get user role
    const { data: user, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !user) return false;

    // Check if role has permission
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    return rolePermissions.includes(permission);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
};

/**
 * Get all permissions for a role
 * @param {String} role - Role name
 * @returns {Array} Permissions
 */
export const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

/**
 * Get user role and permissions
 * @param {String} userId - User ID
 * @returns {Object} User role and permissions
 */
export const getUserRoleAndPermissions = async (userId) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return {
      success: true,
      data: {
        role: user.role,
        permissions: getRolePermissions(user.role),
      },
    };
  } catch (error) {
    console.error('Error getting user role:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Assign role to user
 * @param {String} userId - User ID
 * @param {String} newRole - New role
 * @param {String} assignedBy - Admin who assigned the role
 * @returns {Object} Success status
 */
export const assignRole = async (userId, newRole, assignedBy) => {
  try {
    // Validate role
    if (!Object.values(ROLES).includes(newRole)) {
      throw new Error('Invalid role');
    }

    // Update user role
    const { data, error } = await supabase
      .from('users')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Log role assignment
    await supabase
      .from('role_assignments')
      .insert([
        {
          user_id: userId,
          role: newRole,
          assigned_by: assignedBy,
        },
      ]);

    return {
      success: true,
      data: {
        userId,
        role: newRole,
        permissions: getRolePermissions(newRole),
      },
    };
  } catch (error) {
    console.error('Error assigning role:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all available roles
 * @returns {Object} Roles with permissions
 */
export const getAllRoles = () => {
  return {
    success: true,
    data: Object.entries(ROLES).map(([key, value]) => ({
      key,
      value,
      name: key.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' '),
      permissions: getRolePermissions(value),
    })),
  };
};

/**
 * Get role assignment history
 * @param {String} userId - User ID
 * @returns {Object} Role history
 */
export const getRoleHistory = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('role_assignments')
      .select('*, assigned_by_user:assigned_by(name, email)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error getting role history:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all users by role
 * @param {String} role - Role to filter by
 * @returns {Object} Users with that role
 */
export const getUsersByRole = async (role) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, created_at')
      .eq('role', role)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error getting users by role:', error);
    return { success: false, error: error.message };
  }
};

export default {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  getRolePermissions,
  getUserRoleAndPermissions,
  assignRole,
  getAllRoles,
  getRoleHistory,
  getUsersByRole,
};
