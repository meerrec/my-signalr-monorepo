import { createChatHubConnection } from '../client';
import { runChatWorker } from './runtime';
import type { WorkerScope } from './runtime';

// globalThis вместо self: eslint-глобалы пакета не знают Worker-scope.
runChatWorker({
  scope: globalThis as unknown as WorkerScope,
  createConnection: createChatHubConnection,
});
