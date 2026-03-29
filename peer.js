// peer.js — Реальное P2P + обмен профилями

let peer = null;
let currentPeerId = null;

/**
 * Инициализация PeerJS
 */
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
            console.error('PeerJS global error:', err.type, err);
            if (err.type === 'unavailable-id') {
                alert('Этот Peer ID уже используется. Перезагрузи страницу.');
            }
        });

        peer.on('connection', (conn) => {
            console.log('📥 Входящее соединение от', conn.peer);
            handleIncomingConnection(conn);
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
        if (!peer || peer.destroyed) {
            reject(new Error('PeerJS не инициализирован'));
            return;
        }

        const conn = peer.connect(targetPeerId, { reliable: true, serialization: 'json' });

        let resolved = false;

        conn.on('open', () => {
            if (resolved) return;
            resolved = true;

            // Сразу после открытия соединения запрашиваем профиль
            const myProfile = window.currentProfile || {};
            conn.send({
                type: 'getProfile',
                from: getMyPeerId(),
                profile: {
                    name: myProfile.name || '',
                    surname: myProfile.surname || '',
                    patronymic: myProfile.patronymic || '',
                    avatarUrl: myProfile.avatarUrl || '',
                    peerId: getMyPeerId()
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
 * Обработка входящих соединений и запросов профиля
 */
function handleIncomingConnection(conn) {
    conn.on('data', (data) => {
        console.log('📨 Получены данные от', conn.peer, data);

        if (data.type === 'getProfile') {
            // Отправляем свой профиль в ответ
            const myProfile = window.currentProfile || {};
            conn.send({
                type: 'profileResponse',
                profile: {
                    name: myProfile.name || '',
                    surname: myProfile.surname || '',
                    patronymic: myProfile.patronymic || '',
                    avatarUrl: myProfile.avatarUrl || '',
                    peerId: getMyPeerId()
                }
            });
        }
    });

    conn.on('close', () => console.log('Соединение закрыто с', conn.peer));
}

export { peer };