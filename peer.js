// peer.js — стабильная версия с корректным использованием сохранённого Peer ID

let peer = null;
let currentPeerId = null;
let connections = new Map();
let reconnectTimer = null;
let fallbackTimer = null;

/**
 * Получаем сохранённый Peer ID из профиля
 */
function getSavedPeerId() {
    const saved = localStorage.getItem('profile');
    if (saved) {
        try {
            return JSON.parse(saved).peerId || null;
        } catch (e) {}
    }
    return null;
}

/**
 * Создание Peer
 */
function createPeer(id = null) {
    const peerOptions = {
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
        peerOptions.id = id;
        console.log('🔄 Пытаемся использовать сохранённый Peer ID:', id);
    } else {
        console.log('🆕 Генерируем новый Peer ID...');
    }

    return new Peer(peerOptions);
}

/**
 * Инициализация Peer с правильной логикой fallback
 */
export function initPeer() {
    return new Promise((resolve, reject) => {
        if (peer && !peer.destroyed) {
            resolve(currentPeerId);
            return;
        }

        const savedId = getSavedPeerId();
        let triedWithSavedId = false;

        function start(useSaved) {
            if (peer) {
                try { peer.destroy(); } catch (e) {}
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

                // если был таймер fallback — убиваем его
                if (fallbackTimer) {
                    clearTimeout(fallbackTimer);
                    fallbackTimer = null;
                }

                resolve(id);
            });

            peer.on('error', (err) => {
                console.error('❌ PeerJS error:', err.type, err.message);

                // 🔥 КЛЮЧЕВАЯ ЛОГИКА
                if (err.type === 'unavailable-id' && triedWithSavedId) {
                    console.warn('⚠️ ID временно занят, пробуем восстановить...');

                    // даём время на освобождение ID
                    if (!fallbackTimer) {
                        fallbackTimer = setTimeout(() => {
                            console.warn('⛔ Старый ID не восстановился — создаём новый');
                            start(false);
                        }, 4000);
                    }

                    // пробуем реконнект
                    try {
                        peer.reconnect();
                    } catch (e) {}

                    return;
                }

                if (err.type === 'network' || err.type === 'server-error') {
                    attemptReconnect();
                } else {
                    reject(err);
                }
            });

            peer.on('disconnected', () => {
                console.warn('⚠️ Peer отключён — пробуем вернуть соединение...');
                try {
                    peer.reconnect();
                } catch (e) {}
            });

            peer.on('connection', (conn) => {
                console.log('📥 Входящее соединение от', conn.peer);
                setupConnection(conn);
            });
        }

        // стартуем с сохранённым ID если есть
        start(!!savedId);
    });
}

/**
 * Реконнект при сетевых проблемах
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
 * Сохранение Peer ID в профиль
 */
function savePeerIdToProfile(newId) {
    let profile = {};
    const saved = localStorage.getItem('profile');

    if (saved) {
        try {
            profile = JSON.parse(saved);
        } catch (e) {}
    }

    profile.peerId = newId;

    localStorage.setItem('profile', JSON.stringify(profile));
    window.currentProfile = profile;
}

/**
 * Получить текущий Peer ID
 */
export function getMyPeerId() {
    return currentPeerId || localStorage.getItem('myPeerId') || getSavedPeerId();
}

// === Остальной код без изменений ===

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