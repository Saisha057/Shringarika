import express from 'express';
import { body } from 'express-validator';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { getSupabase } from '../config/supabase.js';

const router = express.Router();

// Validation
const ticketValidation = [
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('category').optional().isIn(['order', 'product', 'payment', 'account', 'other']),
];

// @desc    Create support ticket
// @route   POST /api/support/tickets
// @access  Private
router.post('/tickets', protect, ticketValidation, validate, async (req, res) => {
  try {
    const { subject, message, category } = req.body;
    const supabase = getSupabase();

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert([{
        user_id: req.user.id,
        subject,
        message,
        category: category || 'other',
        status: 'open',
        priority: 'medium'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      status: 'success',
      data: ticket
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating support ticket'
    });
  }
});

// @desc    Get user tickets
// @route   GET /api/support/tickets
// @access  Private
router.get('/tickets', protect, async (req, res) => {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      status: 'success',
      data
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching tickets'
    });
  }
});

// @desc    Get ticket details with messages
// @route   GET /api/support/tickets/:id
// @access  Private
router.get('/tickets/:id', protect, async (req, res) => {
  try {
    const supabase = getSupabase();

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Ticket not found'
      });
    }

    // Check authorization
    if (ticket.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized'
      });
    }

    // Get messages
    const { data: messages } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', req.params.id)
      .order('created_at', { ascending: true });

    res.json({
      status: 'success',
      data: {
        ...ticket,
        messages: messages || []
      }
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching ticket'
    });
  }
});

// @desc    Add message to ticket
// @route   POST /api/support/tickets/:id/messages
// @access  Private
router.post('/tickets/:id/messages', protect, async (req, res) => {
  try {
    const { message } = req.body;
    const supabase = getSupabase();

    // Verify ticket exists and user has access
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (!ticket || (ticket.user_id !== req.user.id && req.user.role !== 'admin')) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized'
      });
    }

    // Add message
    const { data, error } = await supabase
      .from('ticket_messages')
      .insert([{
        ticket_id: req.params.id,
        user_id: req.user.id,
        message,
        is_staff: req.user.role === 'admin'
      }])
      .select()
      .single();

    if (error) throw error;

    // Update ticket
    await supabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.status(201).json({
      status: 'success',
      data
    });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error adding message'
    });
  }
});

// @desc    Get all tickets (Admin)
// @route   GET /api/support/admin/tickets
// @access  Private/Admin
router.get('/admin/tickets', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, priority } = req.query;
    const supabase = getSupabase();

    let query = supabase
      .from('support_tickets')
      .select('*, users!inner(name, email)');

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      status: 'success',
      data
    });
  } catch (error) {
    console.error('Get admin tickets error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching tickets'
    });
  }
});

// @desc    Update ticket (Admin)
// @route   PUT /api/support/admin/tickets/:id
// @access  Private/Admin
router.put('/admin/tickets/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, priority, assigned_to } = req.body;
    const supabase = getSupabase();

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assigned_to) updateData.assigned_to = assigned_to;
    updateData.updated_at = new Date().toISOString();

    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      status: 'success',
      data
    });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating ticket'
    });
  }
});

export default router;
