import { getSupabaseAdmin } from '../config/supabase.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backup storage directory
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

/**
 * Ensure backup directory exists
 */
async function ensureBackupDirectory() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating backup directory:', error);
    throw new Error('Failed to create backup directory');
  }
}

/**
 * Create a database backup
 * @param {Object} options - Backup options
 * @param {string} options.createdBy - User ID creating the backup
 * @param {string[]} options.tables - Array of table names to backup (optional, backs up all if not specified)
 * @param {string} options.backupType - Type of backup: 'full' | 'partial' | 'schema_only'
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Object>} Backup details
 */
export async function createBackup({ createdBy, tables = [], backupType = 'full', metadata = {} }) {
  try {
    await ensureBackupDirectory();
    const supabase = getSupabaseAdmin();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${backupType}_${timestamp}.sql`;
    const filePath = path.join(BACKUP_DIR, filename);

    // Create backup record in database
    const { data: backupRecord, error: insertError } = await supabase
      .from('backups')
      .insert({
        filename,
        file_path: filePath,
        backup_type: backupType,
        status: 'in_progress',
        tables_included: tables.length > 0 ? tables : null,
        created_by: createdBy,
        metadata
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create backup record: ${insertError.message}`);
    }

    try {
      // For Supabase, we'll export data as SQL INSERT statements
      let backupData = `-- Supabase Database Backup
-- Generated: ${new Date().toISOString()}
-- Type: ${backupType}
-- Tables: ${tables.length > 0 ? tables.join(', ') : 'ALL'}

`;

      // Get list of tables to backup
      let tablesToBackup = tables;
      if (tables.length === 0) {
        // Get all tables from database
        const { data: allTables, error: tablesError } = await supabase
          .rpc('get_all_tables');
        
        if (tablesError) {
          // Fallback to common tables if function doesn't exist
          tablesToBackup = [
            'users', 'products', 'orders', 'order_items', 'cart_items',
            'addresses', 'reviews', 'wishlists', 'coupons', 'coupon_usage',
            'support_tickets', 'ticket_messages', 'notifications',
            'audit_logs', 'role_assignments', 'backups'
          ];
        } else {
          tablesToBackup = allTables.map(t => t.table_name);
        }
      }

      let totalRows = 0;

      // Backup each table
      for (const tableName of tablesToBackup) {
        try {
          backupData += `\n-- Table: ${tableName}\n`;

          if (backupType === 'schema_only') {
            backupData += `-- Schema only backup (no data)\n`;
            continue;
          }

          // Get all data from table
          const { data: tableData, error: dataError } = await supabase
            .from(tableName)
            .select('*');

          if (dataError) {
            backupData += `-- Error fetching data from ${tableName}: ${dataError.message}\n`;
            continue;
          }

          if (!tableData || tableData.length === 0) {
            backupData += `-- No data in ${tableName}\n`;
            continue;
          }

          totalRows += tableData.length;

          // Generate INSERT statements
          for (const row of tableData) {
            const columns = Object.keys(row);
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') {
                return `'${val.replace(/'/g, "''")}'`;
              }
              if (typeof val === 'object') {
                return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
              }
              if (typeof val === 'boolean') return val ? 'true' : 'false';
              return val;
            });

            backupData += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
          }

          backupData += `\n`;
        } catch (error) {
          backupData += `-- Error backing up ${tableName}: ${error.message}\n`;
        }
      }

      backupData += `\n-- Backup completed: ${new Date().toISOString()}\n`;
      backupData += `-- Total rows backed up: ${totalRows}\n`;

      // Write backup to file
      await fs.writeFile(filePath, backupData, 'utf8');

      // Get file size
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // Update backup record with success
      const { data: updatedBackup, error: updateError } = await supabase
        .from('backups')
        .update({
          status: 'completed',
          file_size: fileSize,
          completed_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            tables_count: tablesToBackup.length,
            total_rows: totalRows
          }
        })
        .eq('id', backupRecord.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update backup record: ${updateError.message}`);
      }

      return {
        success: true,
        backup: updatedBackup,
        message: `Backup created successfully: ${filename}`,
        stats: {
          tables: tablesToBackup.length,
          rows: totalRows,
          size: `${(fileSize / 1024 / 1024).toFixed(2)} MB`
        }
      };
    } catch (error) {
      // Update backup record with error
      await supabase
        .from('backups')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('id', backupRecord.id);

      throw error;
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}

/**
 * List all backups
 * @param {Object} filters - Filter options
 * @param {number} filters.page - Page number (default: 1)
 * @param {number} filters.limit - Items per page (default: 50)
 * @param {string} filters.status - Filter by status
 * @param {string} filters.backupType - Filter by backup type
 * @returns {Promise<Object>} List of backups with pagination
 */
export async function listBackups({ page = 1, limit = 50, status, backupType } = {}) {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('backups')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (backupType) {
      query = query.eq('backup_type', backupType);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: backups, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch backups: ${error.message}`);
    }

    return {
      success: true,
      backups: backups || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  } catch (error) {
    console.error('Error listing backups:', error);
    throw new Error(`Failed to list backups: ${error.message}`);
  }
}

/**
 * Get backup by ID
 * @param {string} backupId - Backup ID
 * @returns {Promise<Object>} Backup details
 */
export async function getBackupById(backupId) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: backup, error } = await supabase
      .from('backups')
      .select('*')
      .eq('id', backupId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch backup: ${error.message}`);
    }

    if (!backup) {
      throw new Error('Backup not found');
    }

    // Check if file exists
    try {
      await fs.access(backup.file_path);
      backup.file_exists = true;
    } catch {
      backup.file_exists = false;
    }

    return {
      success: true,
      backup
    };
  } catch (error) {
    console.error('Error getting backup:', error);
    throw new Error(`Failed to get backup: ${error.message}`);
  }
}

/**
 * Download backup file
 * @param {string} backupId - Backup ID
 * @returns {Promise<Object>} File path and metadata
 */
export async function downloadBackup(backupId) {
  try {
    const { backup } = await getBackupById(backupId);

    if (!backup.file_exists) {
      throw new Error('Backup file not found on disk');
    }

    return {
      success: true,
      filePath: backup.file_path,
      filename: backup.filename,
      size: backup.file_size,
      mimeType: 'application/sql'
    };
  } catch (error) {
    console.error('Error downloading backup:', error);
    throw new Error(`Failed to download backup: ${error.message}`);
  }
}

/**
 * Restore database from backup
 * WARNING: This will overwrite existing data!
 * @param {string} backupId - Backup ID to restore
 * @param {string} restoredBy - User ID performing the restore
 * @returns {Promise<Object>} Restore result
 */
export async function restoreBackup(backupId, restoredBy) {
  try {
    const supabase = getSupabaseAdmin();
    const { backup } = await getBackupById(backupId);

    if (!backup.file_exists) {
      throw new Error('Backup file not found on disk');
    }

    if (backup.status !== 'completed') {
      throw new Error('Can only restore completed backups');
    }

    // Read backup file
    const backupSQL = await fs.readFile(backup.file_path, 'utf8');

    // Log the restore operation
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        user_id: restoredBy,
        action: 'restore_backup',
        entity_type: 'backup',
        entity_id: backupId,
        metadata: {
          backup_filename: backup.filename,
          backup_date: backup.created_at
        }
      });

    if (logError) {
      console.error('Failed to log restore operation:', logError);
    }

    // WARNING: This is a simplified restore
    // In production, you'd need more sophisticated restore logic
    // that handles transactions, foreign keys, etc.

    return {
      success: true,
      message: 'Backup restore initiated. Note: Manual SQL execution required in Supabase SQL Editor.',
      backup_file: backup.file_path,
      instructions: [
        '1. Download the backup file',
        '2. Open Supabase Dashboard → SQL Editor',
        '3. Copy and paste the backup SQL',
        '4. Execute the SQL statements',
        '5. Verify data integrity'
      ]
    };
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw new Error(`Failed to restore backup: ${error.message}`);
  }
}

/**
 * Delete a backup
 * @param {string} backupId - Backup ID
 * @param {string} deletedBy - User ID deleting the backup
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteBackup(backupId, deletedBy) {
  try {
    const supabase = getSupabaseAdmin();
    const { backup } = await getBackupById(backupId);

    // Delete file from disk
    if (backup.file_exists) {
      try {
        await fs.unlink(backup.file_path);
      } catch (error) {
        console.error('Error deleting backup file:', error);
      }
    }

    // Delete backup record
    const { error: deleteError } = await supabase
      .from('backups')
      .delete()
      .eq('id', backupId);

    if (deleteError) {
      throw new Error(`Failed to delete backup record: ${deleteError.message}`);
    }

    // Log the deletion
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        user_id: deletedBy,
        action: 'delete_backup',
        entity_type: 'backup',
        entity_id: backupId,
        old_values: backup
      });

    if (logError) {
      console.error('Failed to log backup deletion:', logError);
    }

    return {
      success: true,
      message: `Backup ${backup.filename} deleted successfully`
    };
  } catch (error) {
    console.error('Error deleting backup:', error);
    throw new Error(`Failed to delete backup: ${error.message}`);
  }
}

/**
 * Cleanup old backups
 * @param {number} daysOld - Delete backups older than this many days
 * @returns {Promise<Object>} Cleanup result
 */
export async function cleanupOldBackups(daysOld = 30) {
  try {
    const supabase = getSupabaseAdmin();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Get old backups
    const { data: oldBackups, error: fetchError } = await supabase
      .from('backups')
      .select('*')
      .lt('created_at', cutoffDate.toISOString());

    if (fetchError) {
      throw new Error(`Failed to fetch old backups: ${fetchError.message}`);
    }

    if (!oldBackups || oldBackups.length === 0) {
      return {
        success: true,
        message: 'No old backups to delete',
        deleted_count: 0
      };
    }

    let deletedCount = 0;
    let failedCount = 0;

    // Delete each old backup
    for (const backup of oldBackups) {
      try {
        await deleteBackup(backup.id, 'system');
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete backup ${backup.id}:`, error);
        failedCount++;
      }
    }

    return {
      success: true,
      message: `Deleted ${deletedCount} old backups`,
      deleted_count: deletedCount,
      failed_count: failedCount
    };
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
    throw new Error(`Failed to cleanup old backups: ${error.message}`);
  }
}

/**
 * Get backup statistics
 * @returns {Promise<Object>} Backup statistics
 */
export async function getBackupStatistics() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: stats, error } = await supabase
      .rpc('get_backup_statistics');

    if (error) {
      // Fallback to manual calculation if function doesn't exist
      const { data: backups, error: fetchError } = await supabase
        .from('backups')
        .select('*');

      if (fetchError) {
        throw new Error(`Failed to fetch backup statistics: ${fetchError.message}`);
      }

      const total = backups.length;
      const completed = backups.filter(b => b.status === 'completed').length;
      const failed = backups.filter(b => b.status === 'failed').length;
      const inProgress = backups.filter(b => b.status === 'in_progress').length;
      const totalSize = backups.reduce((sum, b) => sum + (b.file_size || 0), 0);

      return {
        success: true,
        statistics: {
          total_backups: total,
          completed_backups: completed,
          failed_backups: failed,
          in_progress_backups: inProgress,
          total_size_bytes: totalSize,
          total_size_mb: (totalSize / 1024 / 1024).toFixed(2),
          average_size_mb: total > 0 ? (totalSize / total / 1024 / 1024).toFixed(2) : 0
        }
      };
    }

    return {
      success: true,
      statistics: stats
    };
  } catch (error) {
    console.error('Error getting backup statistics:', error);
    throw new Error(`Failed to get backup statistics: ${error.message}`);
  }
}
