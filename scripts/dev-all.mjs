import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const SERVER_PORT_START = 5000;
const WEB_PORT_START = 5173;

function canListen(port, host) {
  return new Promise((resolve) => {
    const probe = createServer();

    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen({ port, host, exclusive: true });
  });
}

async function isPortFree(port) {
  const ipv4Free = await canListen(port, '127.0.0.1');
  const ipv6Free = await canListen(port, '::1');
  return ipv4Free && ipv6Free;
}

async function findFreePort(start) {
  for (let port = start; port < start + 100; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }

  throw new Error(`Не найден свободный порт в диапазоне ${start}–${start + 99}`);
}

const serverPort = await findFreePort(SERVER_PORT_START);
const webPort = await findFreePort(WEB_PORT_START);
const signalRUrl = `http://localhost:${serverPort}/hubs/chat`;

const children = [];
let shuttingDown = false;

function signalChild(child, signal) {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  try {
    // Дочерние процессы запускаются в своей группе, чтобы SIGINT/SIGKILL
    // доходил и до внуков: dotnet run → SignalRChat.Server, pnpm → vite.
    if (process.platform === 'win32') {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch {
    // Процесс уже завершился.
  }
}

function shutdown(code) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    signalChild(child, 'SIGINT');
  }

  setTimeout(() => {
    for (const child of children) {
      signalChild(child, 'SIGKILL');
    }
    process.exit(code);
  }, 1000).unref();
}

function start(label, command, args, options) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    ...options,
  });
  children.push(child);

  child.once('error', (error) => {
    console.error(`[dev] ${label}: ${error.message}`);
    shutdown(1);
  });

  child.once('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[dev] ${label} завершился с кодом ${code ?? 1}`);
      shutdown(code ?? 1);
    }
  });

  return child;
}

console.log(`[dev] SignalR: ${signalRUrl}`);
console.log(`[dev] Web:     http://localhost:${webPort}`);

start('server', 'dotnet', [
  'run',
  '--project',
  'server/SignalRChat.Server',
  '--urls',
  `http://localhost:${serverPort}`,
]);

start('web', 'pnpm', ['--filter', '@chat/web', 'exec', 'vite', '--port', String(webPort)], {
  env: { ...process.env, VITE_SIGNALR_URL: signalRUrl },
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
