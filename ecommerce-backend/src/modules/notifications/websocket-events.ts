import { websocketService } from './websocket.service';
import type { WebSocketMessage } from './websocket.service';

export interface OrderUpdateEvent {
  orderId: string;
  status: string;
  userId: string;
  vendorId?: string;
  details?: any;
}

export interface ProductUpdateEvent {
  productId: string;
  vendorId: string;
  type: 'created' | 'updated' | 'deleted' | 'stock_changed';
  details?: any;
}

export interface VendorUpdateEvent {
  vendorId: string;
  type: 'status_changed' | 'profile_updated' | 'payout_processed';
  details?: any;
}