import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { audit } from '../middleware/audit.middleware.js';
import {
  createBackup,
  listBackups,
  getBackupById,
  downloadBackup,
  restoreBackup,
  deleteBackup,
  cleanupOldBackups,
  getBackupStatistics
} from '../services/backup.service.js';

const router = express.Router();

// All routes require admin authentication
router.use(protect);
router.use(authorize('admin'));

/**
 * @route   POST /api/admin/backup/create
 * @desc    Create a new database backup
 * @access  Admin
 */
router.post(
  '/create',
  [
    body('backupType')
      .isIn(['full', 'partial', 'schema_only'])
      .withMessage('Invalid backup type'),
    body('tables')
      .optional()
      .isArray()
      .withMessage('Tables must be an array'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object')
  ],
  audit('create_backup', 'backup'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { backupType, tables, metadata } = req.body;
      const createdBy = req.user.id;

      const result = await createBackup({
        createdBy,
        tables: tables || [],
        backupType: backupType || 'full',
        metadata: metadata || {}
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('Error creating backup:', error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/backup
 * @desc    List all backups with pagination and filtering
 * @access  Admin
 */
router.get(
  '/',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['completed', 'failed', 'in_progress'])
      .withMessage('Invalid status'),
    query('backupType')
      .optional()
      .isIn(['full', 'partial', 'schema_only'])
      .withMessage('Invalid backup type')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const {
        page = 1,
        limit = 50,
        status,
        backupType
      } = req.query;

      const result = await listBackups({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        backupType
      });

      res.json(result);
    } catch (error) {
      console.error('Error listing backups:', error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/backup/stats
 * @desc    Get backup statistics
 * @access  Admin
 */
router.get('/stats', async (req, res, next) => {
  try {
    const result = await getBackupStatistics();
    res.json(result);
  } catch (error) {
    console.error('Error getting backup statistics:', error);
    next(error);
  }
});

/**
 * @route   GET /api/admin/backup/:id
 * @desc    Get backup details by ID
 * @access  Admin
 */
router.get(
  '/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid backup ID')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const result = await getBackupById(id);

      res.json(result);
    } catch (error) {
      console.error('Error getting backup:', error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/backup/:id/download
 * @desc    Download backup file
 * @access  Admin
 */
router.get(
  '/:id/download',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid backup ID')
  ],
  audit('download_backup', 'backup'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const result = await downloadBackup(id);

      // Set headers for file download
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', result.size);

      // Send file
      res.sendFile(result.filePath);
    } catch (error) {
      console.error('Error downloading backup:', error);
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/backup/:id/restore
 * @desc    Restore database from backup
 * @access  Admin (Super Admin only recommended)
 */
router.post(
  '/:id/restore',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid backup ID')
  ],
  audit('restore_backup', 'backup'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const restoredBy = req.user.id;

      const result = await restoreBackup(id, restoredBy);

      res.json(result);
    } catch (error) {
      console.error('Error restoring backup:', error);
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/admin/backup/:id
 * @desc    Delete a backup
 * @access  Admin
 */
router.delete(
  '/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid backup ID')
  ],
  audit('delete_backup', 'backup'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const deletedBy = req.user.id;

      const result = await deleteBackup(id, deletedBy);

      res.json(result);
    } catch (error) {
      console.error('Error deleting backup:', error);
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/admin/backup/cleanup
 * @desc    Cleanup old backups
 * @access  Admin
 */
router.delete(
  '/cleanup/old',
  [
    query('daysOld')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Days old must be between 1 and 365')
  ],
  audit('cleanup_backups', 'backup'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { daysOld = 30 } = req.query;

      const result = await cleanupOldBackups(parseInt(daysOld));

      res.json(result);
    } catch (error) {
      console.error('Error cleaning up backups:', error);
      next(error);
    }
  }
);

export default router;
