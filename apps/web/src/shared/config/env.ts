const DEFAULT_SIGNALR_URL = 'http://localhost:5000/hubs/chat';

const rawSignalRUrl: unknown = import.meta.env.VITE_SIGNALR_URL;
const configuredSignalRUrl =
  typeof rawSignalRUrl === 'string' ? rawSignalRUrl.trim() : '';

export const env = {
  appName: 'SignalR Chat',
  signalRUrl:
    configuredSignalRUrl.length > 0 ? configuredSignalRUrl : DEFAULT_SIGNALR_URL,
} as const;
