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
export { toErrorMessage } from './lib/errors';
export type { SignalRClient, SignalRStatusSnapshot } from './transport/types';
export * from './generated/rest-hooks';
