export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type AsyncStatus = 'idle' | 'pending' | 'success' | 'error';
export type EntityId = string;

export interface AppError {
  code: string;
  message: string;
}
