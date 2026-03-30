// peer.js — новая версия с генерацией Peer ID только по кнопке + формат @login-xxx

let peer = null;
let currentPeerId = null;
let connections = new Map();
let reconnectTimer = null;

/**
 * Транслитерация русского текста в латинский (для логина)
 */
function transliterate(text) {
    const translitMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
        'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    };

    return text.split('').map(char => translitMap[char] || char).join('')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // убираем всё кроме латинских букв и цифр
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Генерация короткого случайного суффикса (8 символов)
 */
function generateSuffix() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

/**
 * Создание красивого Peer ID в формате @login-suffix
 */
function generateNicePeerId(profile) {
    let login = '';

    if (profile.surname || profile.name) {
        const fullName = `${profile.surname || ''} ${profile.name || ''}`.trim();
        login = transliterate(fullName);
    }

    // Если после транслита логин пустой или слишком короткий — используем дефолт
    if (!login || login.length < 2) {
        login = 'user';
    }

    // Ограничиваем длину логина
    if (login.length > 20) {
        login = login.substring(0, 20);
    }

    const suffix = generateSuffix();
    return `@${login}-${suffix}`;
}

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
    return localStorage.getItem('myPeerId') || null;
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
    currentPeerId = newId;
}

/**
 * Создание PeerJS инстанса
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
        console.log('🔄 Используем Peer ID:', id);
    } else {
        console.log('🆕 Создаём Peer без указанного ID (PeerJS сгенерирует свой)');
    }

    return new Peer(peerOptions);
}

/**
 * Инициализация PeerJS (теперь используется только сохранённый ID или null)
 */
export function initPeer() {
    return new Promise((resolve, reject) => {
        if (peer && !peer.destroyed) {
            resolve(currentPeerId || getSavedPeerId());
            return;
        }

        const savedId = getSavedPeerId();

        if (peer) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
        }

        peer = createPeer(savedId);

        peer.on('open', (id) => {
            currentPeerId = id;
            console.log('%c✅ PeerJS подключён! Peer ID:', 'color:#10b981; font-weight:700', id);

            // Сохраняем, только если это новый ID (не было сохранённого)
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
                console.warn('⚠️ Выбранный Peer ID занят. Нужно сгенерировать новый.');
                // В этом случае пользователь должен нажать кнопку "Получить" заново
                reject(new Error('peer-id-unavailable'));
            } 
            else if (err.type === 'network' || err.type === 'server-error') {
                attemptReconnect();
                reject(err);
            } 
            else {
                reject(err);
            }
        });

        peer.on('disconnected', () => {
            console.warn('⚠️ Peer отключён, пытаемся переподключиться...');
            try { peer.reconnect(); } catch (e) {}
        });

        peer.on('connection', (conn) => {
            console.log('📥 Входящее соединение от', conn.peer);
            setupConnection(conn);
        });
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
 * Генерация нового Peer ID (вызывается только по кнопке)
 * Возвращает Promise с новым ID
 */
export async function generateNewPeerId() {
    // Берём текущий профиль
    const profile = window.currentProfile || {};
    
    // Генерируем красивый ID
    let newPeerId = generateNicePeerId(profile);

    console.log('🆕 Сгенерирован новый Peer ID:', newPeerId);

    // Сохраняем сразу в профиль
    savePeerIdToProfile(newPeerId);

    // Инициализируем Peer с новым ID
    try {
        await initPeer(); // теперь initPeer использует сохранённый ID
        return currentPeerId;
    } catch (err) {
        if (err.message === 'peer-id-unavailable') {
            // Если ID оказался занят — генерируем ещё раз с другим суффиксом
            console.warn('ID занят, пробуем другой...');
            newPeerId = generateNicePeerId(profile); // новый суффикс
            savePeerIdToProfile(newPeerId);
            await initPeer();
            return currentPeerId;
        }
        throw err;
    }
}

/**
 * Получить текущий Peer ID
 */
export function getMyPeerId() {
    return currentPeerId || getSavedPeerId();
}

// === Остальные функции без изменений ===
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