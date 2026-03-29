// peer.js — Улучшенная версия с авто-реконнектом к PeerJS Cloud

let peer = null;
let currentPeerId = null;
let connections = new Map();
let reconnectTimer = null;

function getSavedPeerId() {
    const saved = localStorage.getItem('profile');
    if (saved) {
        try {
            return JSON.parse(saved).peerId || null;
        } catch (e) {}
    }
    return null;
}

export function initPeer() {
    return new Promise((resolve, reject) => {
        if (peer && !peer.destroyed) {
            resolve(currentPeerId);
            return;
        }

        const savedId = getSavedPeerId();

        // === ИСПРАВЛЕНИЕ: один объект options ===
        const peerOptions = {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            }
        };

        if (savedId) {
            peerOptions.id = savedId;
        }

        peer = new Peer(peerOptions);

        peer.on('open', (id) => {
            currentPeerId = id;
            console.log('%c✅ PeerJS подключён. Твой Peer ID:', 'color:#10b981; font-weight:700', id);

            if (!savedId) {
                savePeerIdToProfile(id);
            }

            localStorage.setItem('myPeerId', id);
            window.peer = peer;
            window.myPeerId = id;

            resolve(id);
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err.type, err.message);
            if (err.type === 'unavailable-id') {
                alert('Этот Peer ID уже занят. Сгенерируйте новый в настройках профиля.');
            } else if (err.type === 'network' || err.message.includes('Lost connection')) {
                console.warn('Потеряно соединение с PeerJS сервером. Пытаемся переподключиться...');
                attemptReconnect();
            }
        });

        peer.on('disconnected', () => {
            console.warn('PeerJS disconnected от сервера. Переподключаемся...');
            attemptReconnect();
        });

        peer.on('connection', (conn) => {
            console.log('📥 Входящее соединение от', conn.peer);
            setupConnection(conn);
        });
    });
}

function attemptReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    
    reconnectTimer = setTimeout(() => {
        if (peer) {
            peer.reconnect();
        }
    }, 3000);
}

function savePeerIdToProfile(newId) {
    let profile = {};
    const saved = localStorage.getItem('profile');
    if (saved) profile = JSON.parse(saved);
    profile.peerId = newId;
    localStorage.setItem('profile', JSON.stringify(profile));
    window.currentProfile = profile;
}

export function getMyPeerId() {
    return currentPeerId || localStorage.getItem('myPeerId') || getSavedPeerId();
}

export async function ensureConnection(targetPeerId) {
    let conn = connections.get(targetPeerId);
    if (conn && conn.open) return conn;

    console.log(`🔄 Реконнект к контакту ${targetPeerId}...`);
    try {
        conn = await connectToPeer(targetPeerId);
        connections.set(targetPeerId, conn);
        return conn;
    } catch (err) {
        console.error('Не удалось восстановить соединение с контактом:', err);
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
                reject(new Error('timeout'));
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
        console.warn('Нет активного соединения с', targetPeerId);
        return false;
    }

    conn.send({ type: 'message', message: { text, timestamp: Date.now() } });
    return true;
}

export { peer, connections };