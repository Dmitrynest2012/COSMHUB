// peer.js — Стабильная версия для GitHub Pages + PeerJS Cloud

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

        const peerOptions = {
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
            debug: 2,                    // подробные логи
            pingInterval: 5000,          // пинг каждые 5 сек, чтобы не отваливался
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' }
                ]
            }
        };

        if (savedId) {
            peerOptions.id = savedId;
            console.log('🔄 Используем сохранённый Peer ID:', savedId);
        } else {
            console.log('🆕 Генерируем новый Peer ID...');
        }

        peer = new Peer(peerOptions);

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
            if (err.type === 'unavailable-id') {
                alert('Этот Peer ID уже занят. Зайди в профиль → нажми «Получить» для нового ID.');
            } else if (err.type === 'server-error' || err.type === 'network') {
                console.warn('⚠️ Проблемы с PeerJS Cloud. Пробуем переподключиться...');
                attemptReconnect();
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
    });
}

function attemptReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        if (peer && !peer.destroyed) {
            console.log('🔄 Выполняем reconnect...');
            peer.reconnect();
        }
    }, 5000);
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

// === Остальные функции оставляем без изменений ===
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
    conn.send({ type: 'message', message: { text, timestamp: Date.now() } });
    return true;
}

export { peer, connections };