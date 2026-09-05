import { registerSession, dropSession, lookup, sendTo } from './presence.js';
import { enqueue, pull } from './inbox.js';

export function attachSignaling(wss) {
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      await handle(ws, msg);
    });

    ws.on('close', () => dropSession(ws));
    ws.on('error', () => dropSession(ws));
  });

  const timer = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 25000);

  wss.on('close', () => clearInterval(timer));
}

async function handle(ws, msg) {
  switch (msg.type) {
    case 'register': {
      const session = registerSession(ws, msg);
      if (!session) return reply(ws, { type: 'error', error: 'bad-register' });
      const pending = await pull(session.sphereId);
      reply(ws, { type: 'registered', sphereId: session.sphereId, pending });
      break;
    }
    case 'lookup': {
      reply(ws, { type: 'lookup-result', query: msg.sphereId, result: lookup(msg.sphereId) });
      break;
    }
    case 'signal': {
      if (!ws.sphereId || !msg.to || !msg.payload) return;
      const delivered = sendTo(msg.to, {
        type: 'signal',
        from: ws.sphereId,
        payload: msg.payload
      });
      if (!delivered) reply(ws, { type: 'peer-offline', to: msg.to });
      break;
    }
    case 'relay': {
      if (!ws.sphereId || !msg.to || !msg.payload) return;
      const packet = { type: 'relay', from: ws.sphereId, payload: msg.payload };
      const delivered = sendTo(msg.to, packet);
      if (!delivered) await enqueue(msg.to, packet);
      break;
    }
    case 'inbox-pull': {
      if (!ws.sphereId) return;
      reply(ws, { type: 'inbox', pending: await pull(ws.sphereId) });
      break;
    }
    default:
      break;
  }
}

function reply(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}
