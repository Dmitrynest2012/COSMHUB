// peer.js – стабильная версия с корректным использованием сохранённого Peer ID

import Peer from 'peerjs';

let peer = null;                 // экземпляр PeerJS
let currentPeerId = null;        // текущий Peer‑ID (только для удобства)

const PEER_HOST   = '0.peerjs.com';
const PEER_PORT   = 443;
const PEER_PATH   = '/';          // путь к серверу PeerJS
const DEBUG_LEVEL = 2;            // логирование (можно изменить на 3/4 при отладке)

/**
 * Возвращает ID, сохранённый в профиле пользователя.
 */
function getSavedPeerId() {
  const profileStr = localStorage.getItem('profile');
  if (!profileStr) return null;
  try {
    const profile = JSON.parse(profileStr);
    return profile.peerId || null;
  } catch (_) {}
  return null;
}

/**
 * Сохраняет новый Peer‑ID в профиль (если он отличается от старого).
 */
function savePeerIdToProfile(id) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  if (profile.peerId !== id) {
    profile.peerId = id;
    localStorage.setItem('profile', JSON.stringify(profile));
    window.currentProfile = profile;          // если вам нужен глобальный объект
  }
}

/**
 * Создаём Peer с заданными опциями.
 */
function createPeer(id) {
  const options = {
    host: PEER_HOST,
    port: PEER_PORT,
    path: PEER_PATH,
    secure: true,
    debug: DEBUG_LEVEL,
    pingInterval: 5000,          // частота ping‑сообщений
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
    options.id = id;            // если передан конкретный ID – используем его
    console.log('🔄 Пытаемся использовать сохранённый Peer ID:', id);
  } else {
    console.log('🆕 Генерируем новый Peer ID...');
  }

  return new Peer(options);
}

/**
 * Инициализация Peer с «фиксированным» пользовательским ID.
 *
 * @returns {Promise<string>} – открытый Peer‑ID
 */
export function initPeer() {
  if (peer && !peer.destroyed) {
    // Уже инициализировано – ничего не делаем
    return Promise.resolve(currentPeerId);
  }

  const userId = localStorage.getItem('userId');   // UUID, который пользователь создал/записал при логине
  if (!userId) throw new Error('Пользовательский ID не найден');

  peer = createPeer(userId);        // сразу передаём id

  return new Promise((resolve, reject) => {
    peer.on('open', id => {
      currentPeerId = id;
      console.log(`✅ PeerJS открыт с ID: ${id}`);

      // Сохраняем в профиль (если вдруг сервер вернул другой id)
      const profile = JSON.parse(localStorage.getItem('profile') || '{}');
      if (profile.peerId !== id) {
        profile.peerId = id;
        localStorage.setItem('profile', JSON.stringify(profile));
      }

      // Для удобства можно также хранить в отдельном ключе
      localStorage.setItem('myPeerId', id);
      window.peer = peer;          // если нужно видеть глобально
      resolve(id);
    });

    peer.on('error', err => {
      console.error('❌ PeerJS error:', err.type, err.message);

      // Если временно занят ID – просто создаём новый Peer с другим UUID.
      if (err.type === 'unavailable-id') {
        console.warn('⚠️ Сервис временно не дал указанный ID. Создаём новый Peer.');
        peer.destroy();
        peer = createPeer();   // без id → сервер выдаст новый
        return;                // дальше события обработаются в новом экземпляре
      }

      reject(err);
    });

    peer.on('disconnected', () => {
      console.warn('⚠️ Peer отключён – пробуем reconnect');
      try { peer.reconnect(); } catch (_) {}
    });
  });
}

export { peer };
