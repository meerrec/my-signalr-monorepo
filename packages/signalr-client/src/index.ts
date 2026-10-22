export * from './generated/rest';
export * from './generated/hub-contracts';

export { SignalRProvider } from './provider';
export type { SignalRProviderProps, SignalRContextValue } from './provider';
export {
  useSignalRContext,
  useSignalRStatus,
  useHubEvent,
  useHubInvoke,
} from './hooks';
export { createChatHubConnection } from './client';
export { toErrorMessage } from './lib/errors';
export * from './generated/rest-hooks';
