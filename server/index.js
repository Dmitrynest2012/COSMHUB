import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servePublic } from './static.js';
import { acceptUpgrade } from './ws-lite.js';
import { attachSignaling } from './signal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const PORT = Number(process.env.PORT) || 7465;

const handler = servePublic(publicDir);
const clients = new Set();

const wss = {
  clients,
  handlers: {},
  on(event, fn) { this.handlers[event] = fn; },
  emit(event, ws) { this.handlers[event]?.(ws); }
};

const server = http.createServer(handler);

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  const ws = acceptUpgrade(req, socket);
  if (!ws) return;
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  wss.emit('connection', ws);
});

attachSignaling(wss);

server.listen(PORT, '0.0.0.0', () => {
  console.log('Сфера: http://127.0.0.1:' + PORT);
});
