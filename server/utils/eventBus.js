/**
 * eventBus.js — Application-wide Event Bus (Singleton)
 *
 * A Node.js EventEmitter singleton used as the internal event backbone.
 * All application events (order created, payment verified, etc.) are emitted here.
 * Listeners registered via orderEventService / notificationEventService consume them.
 *
 * IMPORTANT: Any listener attached to this bus MUST handle errors internally.
 * A listener crash must NEVER propagate back to the API controller that emitted the event.
 */

import { EventEmitter } from 'events';

// Increase max listeners to avoid Node.js warnings (default is 10)
const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

// ——— Event Name Constants (export so emitters & listeners share the same strings) ———
export const EVENTS = {
  ORDER_CREATED:      'ORDER_CREATED',
  ORDER_CONFIRMED:    'ORDER_CONFIRMED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  PAYMENT_SUCCESS:    'PAYMENT_SUCCESS',
  PAYMENT_FAILED:     'PAYMENT_FAILED',
  RETURN_REQUESTED:   'RETURN_REQUESTED',
  RETURN_APPROVED:    'RETURN_APPROVED',
  EXCHANGE_REQUESTED: 'EXCHANGE_REQUESTED',
  REFUND_COMPLETED:   'REFUND_COMPLETED',
  LOW_STOCK:          'LOW_STOCK',
};

export default eventBus;
