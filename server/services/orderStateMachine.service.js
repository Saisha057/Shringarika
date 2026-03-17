import { getSupabase } from '../config/supabase.js';
import NotificationService from './notification.service.js';

const ORDER_STATES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  PACKED: 'packed',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
  REFUNDED: 'refunded'
};

const STATE_TRANSITIONS = {
  [ORDER_STATES.PENDING]: [ORDER_STATES.CONFIRMED, ORDER_STATES.CANCELLED],
  [ORDER_STATES.CONFIRMED]: [ORDER_STATES.PROCESSING, ORDER_STATES.CANCELLED],
  [ORDER_STATES.PROCESSING]: [ORDER_STATES.PACKED, ORDER_STATES.CANCELLED],
  [ORDER_STATES.PACKED]: [ORDER_STATES.SHIPPED, ORDER_STATES.CANCELLED],
  [ORDER_STATES.SHIPPED]: [ORDER_STATES.OUT_FOR_DELIVERY, ORDER_STATES.RETURNED],
  [ORDER_STATES.OUT_FOR_DELIVERY]: [ORDER_STATES.DELIVERED, ORDER_STATES.RETURNED],
  [ORDER_STATES.DELIVERED]: [ORDER_STATES.RETURNED],
  [ORDER_STATES.RETURNED]: [ORDER_STATES.REFUNDED],
  [ORDER_STATES.CANCELLED]: [],
  [ORDER_STATES.REFUNDED]: []
};

class OrderStateMachine {
  constructor() {
    this.supabase = getSupabase();
  }

  // Validate state transition
  canTransition(currentState, newState) {
    const allowedTransitions = STATE_TRANSITIONS[currentState] || [];
    return allowedTransitions.includes(newState);
  }

  // Transition order to new state
  async transitionOrder(orderId, newState, metadata = {}) {
    try {
      // Get current order
      const { data: order, error: fetchError } = await this.supabase
        .from('orders')
        .select('*, users!inner(*)')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) {
        throw new Error('Order not found');
      }

      // Validate transition
      if (!this.canTransition(order.status, newState)) {
        throw new Error(`Invalid state transition from ${order.status} to ${newState}`);
      }

      // Update order status
      const { data: updatedOrder, error: updateError } = await this.supabase
        .from('orders')
        .update({
          status: newState,
          updated_at: new Date().toISOString(),
          ...metadata
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Create status history entry
      await this.supabase.from('order_status_history').insert({
        order_id: orderId,
        status: newState,
        metadata,
        timestamp: new Date().toISOString()
      });

      // Execute state-specific actions
      await this.executeStateActions(updatedOrder, order.users, newState, metadata);

      return updatedOrder;
    } catch (error) {
      console.error('Order transition error:', error);
      throw error;
    }
  }

  // Execute actions for each state
  async executeStateActions(order, user, newState, metadata) {
    switch (newState) {
      case ORDER_STATES.CONFIRMED:
        await NotificationService.sendOrderConfirmation(order, user);
        await this.allocateStock(order);
        break;

      case ORDER_STATES.PROCESSING:
        await NotificationService.sendOrderStatusUpdate(order, user, newState);
        break;

      case ORDER_STATES.PACKED:
        await NotificationService.sendOrderStatusUpdate(order, user, newState);
        break;

      case ORDER_STATES.SHIPPED:
        await NotificationService.sendOrderStatusUpdate(order, user, newState);
        if (metadata.tracking_number) {
          await this.updateTrackingInfo(order.id, metadata.tracking_number);
        }
        break;

      case ORDER_STATES.OUT_FOR_DELIVERY:
        await NotificationService.sendOrderStatusUpdate(order, user, newState);
        break;

      case ORDER_STATES.DELIVERED:
        await NotificationService.sendOrderStatusUpdate(order, user, newState);
        await this.generateInvoice(order);
        break;

      case ORDER_STATES.CANCELLED:
        await NotificationService.sendOrderStatusUpdate(order, user, newState);
        await this.releaseStock(order);
        await this.initiateRefund(order);
        break;

      case ORDER_STATES.RETURNED:
        await NotificationService.sendOrderStatusUpdate(order, user, newState);
        await this.restockItems(order);
        await this.initiateRefund(order);
        break;

      case ORDER_STATES.REFUNDED:
        await NotificationService.sendOrderStatusUpdate(order, user, newState);
        break;

      default:
        break;
    }
  }

  // Allocate stock when order is confirmed
  async allocateStock(order) {
    try {
      const items = JSON.parse(order.items || '[]');
      
      for (const item of items) {
        await this.supabase
          .from('products')
          .update({
            stock: this.supabase.raw(`stock - ${item.quantity}`),
            reserved_stock: this.supabase.raw(`reserved_stock + ${item.quantity}`)
          })
          .eq('id', item.product_id);
      }
    } catch (error) {
      console.error('Stock allocation error:', error);
    }
  }

  // Release stock when order is cancelled
  async releaseStock(order) {
    try {
      const items = JSON.parse(order.items || '[]');
      
      for (const item of items) {
        await this.supabase
          .from('products')
          .update({
            stock: this.supabase.raw(`stock + ${item.quantity}`),
            reserved_stock: this.supabase.raw(`GREATEST(reserved_stock - ${item.quantity}, 0)`)
          })
          .eq('id', item.product_id);
      }
    } catch (error) {
      console.error('Stock release error:', error);
    }
  }

  // Restock items when order is returned
  async restockItems(order) {
    try {
      const items = JSON.parse(order.items || '[]');
      
      for (const item of items) {
        await this.supabase
          .from('products')
          .update({
            stock: this.supabase.raw(`stock + ${item.quantity}`)
          })
          .eq('id', item.product_id);
      }
    } catch (error) {
      console.error('Restock error:', error);
    }
  }

  // Update tracking information
  async updateTrackingInfo(orderId, trackingNumber) {
    try {
      await this.supabase
        .from('orders')
        .update({ tracking_number: trackingNumber })
        .eq('id', orderId);
    } catch (error) {
      console.error('Tracking update error:', error);
    }
  }

  // Initiate refund (integrate with payment gateway)
  async initiateRefund(order) {
    try {
      // TODO: Integrate with Razorpay or payment gateway refund API
      console.log(`Initiating refund for order ${order.id}, amount: ${order.total_amount}`);
      
      await this.supabase
        .from('refunds')
        .insert({
          order_id: order.id,
          amount: order.total_amount,
          status: 'pending',
          initiated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Refund initiation error:', error);
    }
  }

  // Generate invoice PDF
  async generateInvoice(order) {
    try {
      // Invoice generation is handled by invoice controller
      console.log(`Invoice generation triggered for order ${order.id}`);
    } catch (error) {
      console.error('Invoice generation error:', error);
    }
  }

  // Get order status history
  async getOrderHistory(orderId) {
    try {
      const { data, error } = await this.supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Order history error:', error);
      return [];
    }
  }
}

export default new OrderStateMachine();
export { ORDER_STATES, STATE_TRANSITIONS };
