import express from 'express';
const router = express.Router();

// In-memory storage for errors (in production, use a database)
let errorLogs = [];

// Log error from frontend
router.post('/log', (req, res) => {
  try {
    const { message, stack, componentStack, timestamp, userAgent, url } = req.body;
    
    const errorLog = {
      id: Date.now().toString(),
      message,
      stack,
      componentStack,
      timestamp: timestamp || new Date().toISOString(),
      userAgent,
      url,
      ip: req.ip,
    };
    
    // Store error (limit to last 1000 errors)
    errorLogs.unshift(errorLog);
    if (errorLogs.length > 1000) {
      errorLogs = errorLogs.slice(0, 1000);
    }
    
    console.error('Frontend Error:', {
      message,
      url,
      timestamp: errorLog.timestamp,
    });
    
    res.status(200).json({ success: true, id: errorLog.id });
  } catch (error) {
    console.error('Error logging failed:', error);
    res.status(500).json({ success: false, error: 'Failed to log error' });
  }
});

// Get error logs (admin only)
router.get('/logs', (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const paginatedLogs = errorLogs.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );
    
    res.json({
      logs: paginatedLogs,
      total: errorLogs.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

// Clear error logs (admin only)
router.delete('/logs', (req, res) => {
  try {
    errorLogs = [];
    res.json({ success: true, message: 'Error logs cleared' });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear error logs' });
  }
});

export default router;
