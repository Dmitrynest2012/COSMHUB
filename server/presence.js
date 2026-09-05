const sessions = new Map();

export function registerSession(ws, payload) {
  const sphereId = String(payload.sphereId || '').trim();
  if (!sphereId) return null;

  const prev = sessions.get(sphereId);
  if (prev && prev.ws !== ws) {
    try { prev.ws.close(); } catch {}
  }

  const session = {
    ws,
    sphereId,
    publicKey: payload.publicKey || null,
    profile: sanitizeProfile(payload.profile),
    niceId: payload.niceId || null,
    seenAt: Date.now()
  };
  sessions.set(sphereId, session);
  ws.sphereId = sphereId;
  return session;
}

export function dropSession(ws) {
  const id = ws.sphereId;
  if (!id) return;
  const current = sessions.get(id);
  if (current && current.ws === ws) sessions.delete(id);
}

export function getSession(sphereId) {
  return sessions.get(sphereId) || null;
}

export function lookup(sphereId) {
  const session = sessions.get(sphereId);
  if (!session) return { online: false, sphereId };
  return {
    online: true,
    sphereId: session.sphereId,
    publicKey: session.publicKey,
    profile: session.profile,
    niceId: session.niceId
  };
}

export function sendTo(sphereId, message) {
  const session = sessions.get(sphereId);
  if (!session || session.ws.readyState !== 1) return false;
  session.ws.send(JSON.stringify(message));
  return true;
}

function sanitizeProfile(profile = {}) {
  return {
    name: String(profile.name || '').slice(0, 80),
    surname: String(profile.surname || '').slice(0, 80),
    patronymic: String(profile.patronymic || '').slice(0, 80),
    avatarUrl: String(profile.avatarUrl || '').slice(0, 500)
  };
}
