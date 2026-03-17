/**
 * Real-time Chat Support Service - Socket.io
 * 
 * Features:
 * 1. Real-time messaging between customers and support
 * 2. Typing indicators
 * 3. Read receipts
 * 4. Chat history
 * 5. File sharing
 * 6. Admin chat dashboard
 */

import { Server } from 'socket.io';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

let io = null;
const activeChats = new Map(); // chatId -> { userId, supportId, messages }
const onlineUsers = new Map(); // socketId -> { userId, role }

/**
 * Initialize Socket.io server
 */
export const initializeSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role || 'user';
      
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId} (${socket.userRole})`);
    
    // Store online user
    onlineUsers.set(socket.id, {
      userId: socket.userId,
      role: socket.userRole,
    });

    // Notify admins of new online user
    if (socket.userRole === 'user') {
      io.to('support').emit('user:online', {
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    }

    // Support agents join support room
    if (socket.userRole === 'admin') {
      socket.join('support');
      console.log(`Support agent ${socket.userId} joined support room`);
    }

    // User joins their personal room
    socket.join(`user:${socket.userId}`);

    // Handle chat events
    handleChatEvents(socket);
  });

  console.log('✅ Socket.io chat service initialized');
  return io;
};

/**
 * Handle all chat-related socket events
 */
const handleChatEvents = (socket) => {
  // Start new chat
  socket.on('chat:start', async (data, callback) => {
    try {
      // Create chat in database
      const { data: chat, error } = await supabase
        .from('chats')
        .insert({
          user_id: socket.userId,
          status: 'waiting',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Notify support team
      io.to('support').emit('chat:new', {
        chatId: chat.id,
        userId: socket.userId,
        message: data.initialMessage,
        timestamp: new Date().toISOString(),
      });

      // Send initial message
      if (data.initialMessage) {
        await saveChatMessage(chat.id, socket.userId, data.initialMessage);
      }

      callback({ success: true, chatId: chat.id });
    } catch (error) {
      console.error('Error starting chat:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Support agent accepts chat
  socket.on('chat:accept', async (data, callback) => {
    try {
      if (socket.userRole !== 'admin') {
        throw new Error('Only support agents can accept chats');
      }

      // Update chat status
      const { data: chat, error } = await supabase
        .from('chats')
        .update({
          support_id: socket.userId,
          status: 'active',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', data.chatId)
        .select()
        .single();

      if (error) throw error;

      // Join chat room
      socket.join(`chat:${data.chatId}`);

      // Notify user
      io.to(`user:${chat.user_id}`).emit('chat:accepted', {
        chatId: data.chatId,
        supportAgent: {
          id: socket.userId,
          name: data.agentName || 'Support Agent',
        },
        timestamp: new Date().toISOString(),
      });

      // Store active chat
      activeChats.set(data.chatId, {
        userId: chat.user_id,
        supportId: socket.userId,
      });

      callback({ success: true, chat });
    } catch (error) {
      console.error('Error accepting chat:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Send message
  socket.on('chat:message', async (data, callback) => {
    try {
      const { chatId, message, type = 'text' } = data;

      // Save message to database
      const savedMessage = await saveChatMessage(
        chatId,
        socket.userId,
        message,
        type
      );

      // Get chat details
      const chat = activeChats.get(chatId);
      
      // Broadcast to chat room
      io.to(`chat:${chatId}`).emit('chat:message', {
        messageId: savedMessage.id,
        chatId,
        senderId: socket.userId,
        message,
        type,
        timestamp: savedMessage.created_at,
      });

      // Notify other party
      const recipientId = socket.userId === chat.userId ? chat.supportId : chat.userId;
      io.to(`user:${recipientId}`).emit('chat:message', {
        messageId: savedMessage.id,
        chatId,
        senderId: socket.userId,
        message,
        type,
        timestamp: savedMessage.created_at,
      });

      callback({ success: true, messageId: savedMessage.id });
    } catch (error) {
      console.error('Error sending message:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Typing indicator
  socket.on('chat:typing', (data) => {
    const { chatId, isTyping } = data;
    const chat = activeChats.get(chatId);
    
    if (chat) {
      const recipientId = socket.userId === chat.userId ? chat.supportId : chat.userId;
      io.to(`user:${recipientId}`).emit('chat:typing', {
        chatId,
        userId: socket.userId,
        isTyping,
      });
    }
  });

  // Mark message as read
  socket.on('chat:read', async (data, callback) => {
    try {
      const { messageId } = data;

      await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);

      // Notify sender
      const { data: message } = await supabase
        .from('chat_messages')
        .select('chat_id, sender_id')
        .eq('id', messageId)
        .single();

      if (message) {
        io.to(`user:${message.sender_id}`).emit('chat:read', {
          messageId,
          readAt: new Date().toISOString(),
        });
      }

      callback({ success: true });
    } catch (error) {
      console.error('Error marking message as read:', error);
      callback({ success: false, error: error.message });
    }
  });

  // End chat
  socket.on('chat:end', async (data, callback) => {
    try {
      const { chatId, rating, feedback } = data;

      // Update chat status
      const { error } = await supabase
        .from('chats')
        .update({
          status: 'closed',
          ended_at: new Date().toISOString(),
          rating,
          feedback,
        })
        .eq('id', chatId);

      if (error) throw error;

      // Notify both parties
      io.to(`chat:${chatId}`).emit('chat:ended', {
        chatId,
        timestamp: new Date().toISOString(),
      });

      // Remove from active chats
      activeChats.delete(chatId);

      callback({ success: true });
    } catch (error) {
      console.error('Error ending chat:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Get chat history
  socket.on('chat:history', async (data, callback) => {
    try {
      const { chatId } = data;

      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      callback({ success: true, messages });
    } catch (error) {
      console.error('Error getting chat history:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Get active chats (support agent)
  socket.on('chat:list', async (callback) => {
    try {
      if (socket.userRole !== 'admin') {
        throw new Error('Only support agents can list chats');
      }

      const { data: chats, error } = await supabase
        .from('chats')
        .select(`
          *,
          users:user_id (id, name, email),
          last_message:chat_messages (message, created_at)
        `)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      callback({ success: true, chats });
    } catch (error) {
      console.error('Error listing chats:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
    
    // Remove from online users
    onlineUsers.delete(socket.id);

    // Notify admins
    if (socket.userRole === 'user') {
      io.to('support').emit('user:offline', {
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    }

    // Update active chats
    for (const [chatId, chat] of activeChats.entries()) {
      if (chat.userId === socket.userId || chat.supportId === socket.userId) {
        io.to(`chat:${chatId}`).emit('chat:user_disconnected', {
          userId: socket.userId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });
};

/**
 * Save chat message to database
 */
const saveChatMessage = async (chatId, senderId, message, type = 'text') => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        chat_id: chatId,
        sender_id: senderId,
        message,
        type,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error saving chat message:', error);
    throw error;
  }
};

/**
 * Get online support agents count
 */
export const getOnlineSupportCount = () => {
  let count = 0;
  for (const user of onlineUsers.values()) {
    if (user.role === 'admin') {
      count++;
    }
  }
  return count;
};

/**
 * Get active chats count
 */
export const getActiveChatsCount = () => {
  return activeChats.size;
};

/**
 * Send system message to chat
 */
export const sendSystemMessage = (chatId, message) => {
  if (!io) return;
  
  io.to(`chat:${chatId}`).emit('chat:system_message', {
    chatId,
    message,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Broadcast message to all online users
 */
export const broadcastToAll = (event, data) => {
  if (!io) return;
  
  io.emit(event, data);
};

/**
 * Send message to specific user
 */
export const sendToUser = (userId, event, data) => {
  if (!io) return;
  
  io.to(`user:${userId}`).emit(event, data);
};

export default {
  initializeSocketIO,
  getOnlineSupportCount,
  getActiveChatsCount,
  sendSystemMessage,
  broadcastToAll,
  sendToUser,
};
