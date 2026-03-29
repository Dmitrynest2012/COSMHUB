// peer.js — Реальное P2P соединение через PeerJS (улучшенная версия)

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

        // Создаём Peer с явными параметрами для стабильности
        peer = new Peer({
            debug: 2,                    // Уровень логирования (0-3), 2 — хороший баланс
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
            } else if (err.type === 'peer-unavailable') {
                console.warn('Целевой peer недоступен');
            } else if (err.type === 'disconnected') {
                console.warn('PeerJS отключился от сервера');
            }
        });

        // Принимаем входящие соединения
        peer.on('connection', (conn) => {
            console.log('📥 Входящее соединение от', conn.peer);
            handleIncomingConnection(conn);
        });

        // Таймаут на инициализацию (мало ли)
        setTimeout(() => {
            if (!currentPeerId) {
                reject(new Error('PeerJS initialization timeout'));
            }
        }, 10000);
    });
}

/**
 * Получить текущий Peer ID
 */
export function getMyPeerId() {
    return currentPeerId || localStorage.getItem('myPeerId');
}

/**
 * Подключение к другому пиру (главная проблема была здесь)
 */
export function connectToPeer(targetPeerId) {
    return new Promise((resolve, reject) => {
        if (!peer || peer.destroyed) {
            reject(new Error('PeerJS не инициализирован'));
            return;
        }

        console.log(`🔗 Создаём соединение с ${targetPeerId}`);

        const conn = peer.connect(targetPeerId, { 
            reliable: true,
            serialization: 'json'   // явно указываем, чтобы избежать проблем
        });

        let resolved = false;

        conn.on('open', () => {
            if (resolved) return;
            resolved = true;
            console.log('✅ DataConnection открыто с', targetPeerId);
            resolve(conn);
        });

        conn.on('error', (err) => {
            console.error('Соединение ошибка:', err);
            if (!resolved) {
                resolved = true;
                reject(err);
            }
        });

        // Увеличили таймаут до 15 секунд + более точная проверка
        setTimeout(() => {
            if (!resolved && (!conn.open || conn.open === false)) {
                console.warn('Таймаут соединения, закрываем');
                resolved = true;
                conn.close();
                reject(new Error('timeout'));
            }
        }, 15000);
    });
}

/**
 * Обработка входящего соединения
 */
function handleIncomingConnection(conn) {
    conn.on('open', () => {
        console.log('Соединение открыто (входящее) от', conn.peer);
    });

    conn.on('data', (data) => {
        console.log('📨 Получены данные от', conn.peer, data);
        // Здесь позже будем обрабатывать запросы профиля
    });

    conn.on('close', () => {
        console.log('Соединение закрыто с', conn.peer);
    });
}

export { peer };