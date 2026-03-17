/**
 * Audit Middleware
 * Automatically logs admin actions
 */

import { logAction } from '../services/auditLogs.service.js';

/**
 * Extract IP address from request
 */
const getIpAddress = (req) => {
  return req.ip || 
         req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         'unknown';
};

/**
 * Audit middleware for logging actions
 * Usage: router.post('/route', protect, audit('action_name', 'entity_type'), handler)
 */
export const audit = (action, entityType) => {
  return async (req, res, next) => {
    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to intercept response
    res.json = function (data) {
      // Only log if response is successful
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Log asynchronously (don't wait for it)
        (async () => {
          try {
            let entityId = null;
            let oldValues = null;
            let newValues = null;

            // Extract entity ID from various sources
            if (req.params.id) {
              entityId = req.params.id;
            } else if (req.params.userId) {
              entityId = req.params.userId;
            } else if (req.params.productId) {
              entityId = req.params.productId;
            } else if (req.params.orderId) {
              entityId = req.params.orderId;
            } else if (data && data.id) {
              entityId = data.id;
            } else if (data && data.data && data.data.id) {
              entityId = data.data.id;
            }

            // Extract old and new values if available
            if (req.body) {
              newValues = { ...req.body };
              // Remove sensitive fields
              delete newValues.password;
              delete newValues.token;
            }

            // Store old values if entity was fetched before
            if (req._oldEntityValues) {
              oldValues = req._oldEntityValues;
            }

            await logAction({
              userId: req.user?.id || null,
              userName: req.user?.name || 'Unknown',
              userEmail: req.user?.email || 'unknown@example.com',
              action,
              entityType,
              entityId: entityId ? String(entityId) : null,
              oldValues,
              newValues,
              ipAddress: getIpAddress(req),
              userAgent: req.headers['user-agent'] || 'Unknown',
              metadata: {
                method: req.method,
                path: req.path,
                query: req.query,
              },
            });
          } catch (error) {
            console.error('Error logging audit action:', error);
            // Don't throw error - just log it
          }
        })();
      }

      // Call original res.json
      return originalJson(data);
    };

    next();
  };
};

/**
 * Middleware to capture entity before update/delete
 * Use this before audit middleware to capture old values
 */
export const captureEntityBefore = (entityType, getEntityFn) => {
  return async (req, res, next) => {
    try {
      let entityId = req.params.id || req.params.userId || req.params.productId || req.params.orderId;

      if (entityId && getEntityFn) {
        const entity = await getEntityFn(entityId);
        req._oldEntityValues = entity;
      }
    } catch (error) {
      console.error('Error capturing entity before:', error);
      // Continue even if capture fails
    }

    next();
  };
};

/**
 * Audit logger for bulk operations
 */
export const auditBulk = (action, entityType) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        (async () => {
          try {
            // Log each entity in bulk operation
            const entities = req.body.updates || req.body.productIds || req.body.orderIds || req.body.userIds || [];
            
            for (const entity of entities) {
              const entityId = entity.id || entity.productId || entity.orderId || entity.userId || entity;

              await logAction({
                userId: req.user?.id || null,
                userName: req.user?.name || 'Unknown',
                userEmail: req.user?.email || 'unknown@example.com',
                action: `bulk_${action}`,
                entityType,
                entityId: String(entityId),
                oldValues: null,
                newValues: typeof entity === 'object' ? entity : null,
                ipAddress: getIpAddress(req),
                userAgent: req.headers['user-agent'] || 'Unknown',
                metadata: {
                  method: req.method,
                  path: req.path,
                  bulkOperation: true,
                  totalEntities: entities.length,
                },
              });
            }
          } catch (error) {
            console.error('Error logging bulk audit action:', error);
          }
        })();
      }

      return originalJson(data);
    };

    next();
  };
};

export default {
  audit,
  captureEntityBefore,
  auditBulk,
};
