// peer.js — PeerJS с авто-реконнектом

let peer = null;
let currentPeerId = null;
let connections = new Map(); // peerId → DataConnection

export function initPeer() {
    return new Promise((resolve, reject) => {
        if (peer && !peer.destroyed) {
            resolve(currentPeerId);
            return;
        }

        peer = new Peer({
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', (id) => {
            currentPeerId = id;
            console.log('%c✅ PeerJS подключён. Твой Peer ID:', 'color:#10b981; font-weight:700', id);
            localStorage.setItem('myPeerId', id);
            window.peer = peer;
            window.myPeerId = id;
            resolve(id);
        });

        peer.on('error', (err) => console.error('PeerJS error:', err.type, err));

        peer.on('connection', (conn) => {
            console.log('📥 Входящее соединение от', conn.peer);
            setupConnection(conn);
        });
    });
}

export function getMyPeerId() {
    return currentPeerId || localStorage.getItem('myPeerId');
}

/**
 * Гарантированно возвращает активное соединение (авто-реконнект)
 */
export async function ensureConnection(targetPeerId) {
    let conn = connections.get(targetPeerId);

    // Если соединение уже есть и открыто — возвращаем его
    if (conn && conn.open) {
        return conn;
    }

    console.log(`🔄 Реконнект к ${targetPeerId}...`);

    try {
        conn = await connectToPeer(targetPeerId);
        connections.set(targetPeerId, conn);
        return conn;
    } catch (err) {
        console.error('Не удалось восстановить соединение:', err);
        throw err;
    }
}

/**
 * Внутреннее подключение (используется и вручную, и при реконнекте)
 */
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
    if (!conn || !conn.open) return false;

    conn.send({
        type: 'message',
        message: { text, timestamp: Date.now() }
    });
    return true;
}

export { peer, connections };