// peer.js — стабильная версия с корректным использованием сохранённого Peer ID

import Peer from 'peerjs';

let peer = null;                     // экземпляр PeerJS
let currentPeerId = null;            // текущий открытый ID (для отладки)
       // map id → connection object
let reconnectTimer = null;           // таймер «reconnect» при сетевых проблемах
let fallbackTimer = null;            // таймер «fallback», когда сервер вернул unavailable‑id

/**
 * Получаем сохранённый Peer ID из профиля пользователя.
 */
function getSavedPeerId() {
  const saved = localStorage.getItem('profile');
  if (!saved) return null;
  try {
    const profile = JSON.parse(saved);
    return profile.peerId || null;
  } catch (_) {}
  return null;
}

/**
 * Сохраняем новый Peer ID в профиль (если он отличается от старого).
 */
function savePeerIdToProfile(newId) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  if (profile.peerId !== newId) {
    profile.peerId = newId;
    localStorage.setItem('profile', JSON.stringify(profile));
    window.currentProfile = profile; // глобальный объект, если нужен
  }
}

/**
 * Создаём Peer‑сокета с указанными опциями.
 */
function createPeer(id) {
  const options = {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    debug: 2,
    pingInterval: 5000,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
      ]
    }
  };

  if (id) {
    options.id = id;
    console.log('🔄 Пытаемся использовать сохранённый Peer ID:', id);
  } else {
    console.log('🆕 Генерируем новый Peer ID...');
  }

  return new Peer(options);
}

/**
 * Инициализация Peer с «fallback»‑логикой.
 *
 * Возвращает Promise, который будет решён IDом, полученным от сервера
 * (может быть тем же самым, что в профиле, либо новым, если сервер отказался).
 */
export function initPeer() {
  return new Promise((resolve, reject) => {
    if (peer && !peer.destroyed) {
      resolve(currentPeerId);
      return;
    }

    const savedId = getSavedPeerId();
    let triedWithSavedId = false;

    /**
     * Функция‑обёртка для старта Peer.
     */
    function start(useSaved) {
      if (peer) {
        try { peer.destroy(); } catch (_) {}
        peer = null;
      }

      triedWithSavedId = useSaved;
      const idToUse = useSaved ? savedId : null;

      peer = createPeer(idToUse);

      peer.on('open', (id) => {
        currentPeerId = id;
        console.log('%c✅ PeerJS подключён! Твой Peer ID:', 'color:#10b981; font-weight:700', id);

        // сохраняем только если реально новый
        if (!savedId || savedId !== id) {
          savePeerIdToProfile(id);
        }

        localStorage.setItem('myPeerId', id);
        window.peer = peer;
        window.myPeerId = id;

        // убираем возможный fallback‑таймер (он больше не нужен)
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }

        resolve(id);
      });

      /**
       * Обрабатываем ошибки.
       */
      peer.on('error', (err) => {
        console.error('❌ PeerJS error:', err.type, err.message);

        // 🔥 КЛЮЧЕВАЯ ЛОГИКА для «unavailable‑id»
        if (err.type === 'unavailable-id' && triedWithSavedId) {
          console.warn('⚠️ ID временно занят, пробуем восстановить...');

          // даём время на освобождение ID
          if (!fallbackTimer) {
            fallbackTimer = setTimeout(() => {
              console.warn('⛔ Старый ID не восстановился — создаём новый');
              start(false);               // без savedId → сервер выдаёт новый UUID
            }, 4000);
          }

          // пытаемся реконнектнуть к тому же соединению (может быть уже открыто)
          try {
            peer.reconnect();
          } catch (_) {}
          return;
        }

        if (err.type === 'network' || err.type === 'server-error') {
          attemptReconnect();
        } else {
          reject(err);
        }
      });

      /**
       * При получении новых соединений.
       */
      peer.on('disconnected', () => {
        console.warn('⚠️ Peer отключён — пробуем вернуть соединение...');
        try { peer.reconnect(); } catch (_) {}
      });

      peer.on('connection', (conn) => {
        console.log('📥 Входящее соединение от', conn.peer);
        setupConnection(conn);
      });
    }

    // стартуем с сохранённым ID, если он есть
    start(!!savedId);
  });
}

/**
 * Попытка reconnect при сетевых проблемах.
 */
function attemptReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);

  reconnectTimer = setTimeout(() => {
    if (peer && !peer.destroyed) {
      console.log('🔄 Выполняем reconnect...');
      peer.reconnect();
    }
  }, 5000);
}

/**
 * Сохраняем полученный ID в профиль пользователя.
 */
function savePeerIdToProfile(newId) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  if (profile.peerId !== newId) {
    profile.peerId = newId;
    localStorage.setItem('profile', JSON.stringify(profile));
    window.currentProfile = profile;
  }
}

/**
 * Получить текущий Peer ID.
 */
export function getMyPeerId() {
  return currentPeerId || localStorage.getItem('myPeerId') || getSavedPeerId();
}

// === Остальной код без изменений ===

let connections = new Map(); // уже объявляем выше, но оставляем для синтаксической стабильности

/**
 * Убедимся, что соединение с `targetPeerId` открыто.
 */
export async function ensureConnection(targetPeerId) {
  let conn = connections.get(targetPeerId);
  if (conn && conn.open) return conn;

  try {
    conn = await connectToPeer(targetPeerId);
    connections.set(targetPeerId, conn);
    return conn;
  } catch (err) {
    console.error('Не удалось подключиться к', targetPeerId, err);
    throw err;
  }
}

/**
 * Открывает соединение с `targetPeerId`.
 */
export function connectToPeer(targetPeerId) {
  return new Promise((resolve, reject) => {
    if (!peer || peer.destroyed) {
      return reject(new Error('PeerJS не инициализирован'));
    }

    const conn = peer.connect(targetPeerId, {
      reliable: true,
      serialization: 'json'
    });

    let resolved = false;

    conn.on('open', () => {
      if (resolved) return;
      resolved = true;
      setupConnection(conn);
      resolve(conn);
    });

    conn.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        conn.close();
        reject(new Error('Таймаут подключения'));
      }
    }, 15000);
  });
}

/**
 * Настроить обработку данных по новому соединению.
 */
function setupConnection(conn) {
  const peerId = conn.peer;
  connections.set(peerId, conn);

  conn.on('data', (data) => {
    if (data.type === 'getProfile') {
      const myProfile = window.currentProfile || {};
      conn.send({ type: 'profileResponse', profile: myProfile });
    }

    if (data.type === 'message' && window.handleIncomingMessage) {
      window.handleIncomingMessage(peerId, data.message);
    }
  });

  conn.on('close', () => connections.delete(peerId));
}

/**
 * Отправка сообщения в `targetPeerId`.
 */
export function sendMessage(targetPeerId, text) {
  const conn = connections.get(targetPeerId);

  if (!conn || !conn.open) {
    console.warn('Нет соединения с', targetPeerId);
    return false;
  }

  conn.send({
    type: 'message',
    message: {
      text,
      timestamp: Date.now()
    }
  });

  return true;
}

export { peer, connections };
