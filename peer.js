// peer.js — Реальное P2P соединение через PeerJS

let peer = null;
let currentPeerId = null;

/**
 * Инициализация PeerJS
 */
export function initPeer() {
    return new Promise((resolve) => {
        // Если уже создан — возвращаем сразу
        if (peer && !peer.destroyed) {
            resolve(currentPeerId);
            return;
        }

        peer = new Peer(); // использует бесплатный PeerJS Cloud

        peer.on('open', (id) => {
            currentPeerId = id;
            console.log('%c✅ PeerJS подключён. Твой Peer ID:', 'color:#10b981; font-weight:700', id);
            
            // Сохраняем ID в localStorage (чтобы можно было восстановить)
            localStorage.setItem('myPeerId', id);
            
            // Делаем глобально доступным
            window.peer = peer;
            window.myPeerId = id;
            
            resolve(id);
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            if (err.type === 'unavailable-id') {
                alert('Этот Peer ID уже используется. Перезагрузи страницу.');
            }
        });

        // Принимаем входящие соединения (для будущего чата)
        peer.on('connection', (conn) => {
            console.log('Входящее соединение от', conn.peer);
            handleIncomingConnection(conn);
        });
    });
}

/**
 * Получить текущий Peer ID
 */
export function getMyPeerId() {
    return currentPeerId || localStorage.getItem('myPeerId');
}

/**
 * Подключение к другому пиру (поиск)
 */
export function connectToPeer(targetPeerId) {
    return new Promise((resolve, reject) => {
        if (!peer || peer.destroyed) {
            reject(new Error('PeerJS не инициализирован'));
            return;
        }

        const conn = peer.connect(targetPeerId, { reliable: true });

        conn.on('open', () => {
            console.log('Соединение установлено с', targetPeerId);
            resolve(conn);
        });

        conn.on('error', (err) => {
            console.error('Ошибка соединения:', err);
            reject(err);
        });

        // Таймаут 8 секунд
        setTimeout(() => {
            if (conn.open === false) {
                conn.close();
                reject(new Error('timeout'));
            }
        }, 8000);
    });
}

/**
 * Обработка входящего соединения (пока просто логируем)
 */
function handleIncomingConnection(conn) {
    conn.on('data', (data) => {
        console.log('Получены данные от', conn.peer, data);
        // Здесь в будущем можно отвечать профилем и т.д.
    });
}

// Экспортируем peer для других модулей
export { peer };