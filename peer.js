// peer.js — Стабильная версия с fallback на новый ID

let peer = null;
let currentPeerId = null;
let connections = new Map();
let reconnectTimer = null;

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
 * Инициализация Peer с fallback
 */
export function initPeer() {
    return new Promise((resolve, reject) => {
        if (peer && !peer.destroyed) {
            resolve(currentPeerId);
            return;
        }

        const savedId = getSavedPeerId();

        let triedWithSavedId = false;

        function start(withSavedId) {
            if (peer) {
                try { peer.destroy(); } catch (e) {}
                peer = null;
            }

            const idToUse = withSavedId ? savedId : null;
            triedWithSavedId = withSavedId;

            peer = createPeer(idToUse);

            peer.on('open', (id) => {
                currentPeerId = id;

                console.log('%c✅ PeerJS подключён! Твой Peer ID:', 'color:#10b981; font-weight:700', id);

                if (!savedId || savedId !== id) {
                    savePeerIdToProfile(id);
                }

                localStorage.setItem('myPeerId', id);
                window.peer = peer;
                window.myPeerId = id;

                resolve(id);
            });

            peer.on('error', (err) => {
                console.error('❌ PeerJS error:', err.type, err.message);

                // 🔥 КЛЮЧЕВОЙ FIX
                if (err.type === 'unavailable-id' && triedWithSavedId) {
                    console.warn('⚠️ ID занят, пробуем создать новый...');
                    start(false); // fallback на новый ID
                    return;
                }

                if (err.type === 'server-error' || err.type === 'network') {
                    console.warn('⚠️ Проблемы с сетью. Пробуем reconnect...');
                    attemptReconnect();
                } else {
                    reject(err);
                }
            });

            peer.on('disconnected', () => {
                console.warn('⚠️ PeerJS отключился. Переподключаемся...');
                attemptReconnect();
            });

            peer.on('connection', (conn) => {
                console.log('📥 Входящее соединение от', conn.peer);
                setupConnection(conn);
            });
        }

        // стартуем
        start(!!savedId);
    });
}

/**
 * Реконнект
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

    if (saved) profile = JSON.parse(saved);

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
        if (!peer || peer.destroyed) return reject(new Error('PeerJS не инициализирован'));

        const conn = peer.connect(targetPeerId, { reliable: true, serialization: 'json' });
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