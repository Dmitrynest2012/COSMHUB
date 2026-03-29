// peer.js — PeerJS + обмен профилями и сообщениями

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

        peer.on('error', (err) => {
            console.error('PeerJS error:', err.type, err);
        });

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
 * Подключение + запрос профиля
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

            // Запрашиваем профиль
            const myProfile = window.currentProfile || {};
            conn.send({
                type: 'getProfile',
                profile: {
                    name: myProfile.name || '',
                    surname: myProfile.surname || '',
                    patronymic: myProfile.patronymic || '',
                    avatarUrl: myProfile.avatarUrl || ''
                }
            });

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

/**
 * Настройка соединения (общие обработчики)
 */
function setupConnection(conn) {
    const peerId = conn.peer;
    connections.set(peerId, conn);

    conn.on('data', (data) => {
        console.log('📨 Получено от', peerId, data);

        if (data.type === 'getProfile') {
            const myProfile = window.currentProfile || {};
            conn.send({
                type: 'profileResponse',
                profile: {
                    name: myProfile.name || '',
                    surname: myProfile.surname || '',
                    patronymic: myProfile.patronymic || '',
                    avatarUrl: myProfile.avatarUrl || ''
                }
            });
        }

        if (data.type === 'message') {
            // Передаём сообщение в чат
            if (window.handleIncomingMessage) {
                window.handleIncomingMessage(peerId, data.message);
            }
        }
    });

    conn.on('close', () => {
        console.log('Соединение закрыто с', peerId);
        connections.delete(peerId);
    });
}

/**
 * Отправка сообщения
 */
export function sendMessage(targetPeerId, text) {
    const conn = connections.get(targetPeerId);
    if (!conn || !conn.open) {
        console.warn('Нет активного соединения с', targetPeerId);
        return false;
    }

    conn.send({
        type: 'message',
        message: {
            text: text,
            timestamp: Date.now()
        }
    });

    return true;
}

export { peer, connections };