// peer.js — Nice ID (@login-xxxxxxxx) + история до 10 real ID + поддержка статуса «Печатает»

let peer = null;
let currentRealPeerId = null;     // Текущий реальный ID от PeerJS
let currentNicePeerId = null;     // Красивый постоянный ID
let connections = new Map();
let reconnectTimer = null;

const MAX_REAL_IDS_HISTORY = 10;

/**
 * Транслитерация русского текста в латинский
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
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
        'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    };

    return text.split('').map(char => translitMap[char] || char).join('')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Генерация короткого случайного суффикса
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
 * Генерация красивого Nice Peer ID
 */
function generateNicePeerId(profile) {
    let login = '';

    if (profile.surname || profile.name) {
        const fullName = `${profile.surname || ''} ${profile.name || ''}`.trim();
        login = transliterate(fullName);
    }

    if (!login || login.length < 2) login = 'user';
    if (login.length > 20) login = login.substring(0, 20);

    return `@${login}-${generateSuffix()}`;
}

/* ====================== Работа с Nice ID ====================== */

function getSavedNicePeerId() {
    const saved = localStorage.getItem('profile');
    if (saved) {
        try {
            return JSON.parse(saved).nicePeerId || null;
        } catch (e) {}
    }
    return null;
}

function saveNicePeerIdToProfile(niceId) {
    let profile = {};
    const saved = localStorage.getItem('profile');
    if (saved) {
        try { profile = JSON.parse(saved); } catch (e) {}
    }

    profile.nicePeerId = niceId;
    localStorage.setItem('profile', JSON.stringify(profile));
    window.currentProfile = profile;
    currentNicePeerId = niceId;
}

/* ====================== История real ID (до 10 штук) ====================== */

function getRealIdsHistory() {
    const saved = localStorage.getItem('realPeerIdsHistory');
    return saved ? JSON.parse(saved) : [];
}

function saveRealIdToHistory(realId) {
    if (!realId) return;
    let history = getRealIdsHistory();
    
    // Убираем дубликат
    history = history.filter(id => id !== realId);
    
    // Добавляем новый в начало
    history.unshift(realId);
    
    // Оставляем только последние 10
    history = history.slice(0, MAX_REAL_IDS_HISTORY);
    
    localStorage.setItem('realPeerIdsHistory', JSON.stringify(history));
    console.log(`📜 История real ID обновлена (${history.length} шт.)`);
}

/* ====================== PeerJS ====================== */

function createPeer() {
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

    return new Peer(peerOptions);
}

/**
 * Инициализация PeerJS
 */
export function initPeer() {
    return new Promise((resolve, reject) => {
        if (peer && !peer.destroyed) {
            resolve(currentRealPeerId);
            return;
        }

        currentNicePeerId = getSavedNicePeerId();

        if (peer) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
        }

        peer = createPeer();

        peer.on('open', (id) => {
            currentRealPeerId = id;
            saveRealIdToHistory(id);

            console.log('%c✅ PeerJS успешно подключён', 'color:#10b981; font-weight:700');
            console.log('   Nice ID (для друзей):', currentNicePeerId || 'не задан');
            console.log('   Real ID (текущий):', id);

            window.peer = peer;
            window.myRealPeerId = id;
            window.myNicePeerId = currentNicePeerId;

            resolve(id);
        });

        peer.on('error', (err) => {
            console.error('❌ PeerJS error:', err.type, err.message);

            if (err.type === 'network' || err.type === 'server-error') {
                attemptReconnect();
            } else {
                reject(err);
            }
        });

        peer.on('disconnected', () => {
            console.warn('⚠️ Peer отключён — пытаемся переподключиться...');
            try { peer.reconnect(); } catch (e) {}
        });

        peer.on('connection', (conn) => {
            console.log('📥 Входящее соединение от', conn.peer);
            setupConnection(conn);
        });
    });
}

/**
 * Генерация нового красивого Nice ID (только по кнопке)
 */
export async function generateNewNicePeerId() {
    const profile = window.currentProfile || {};
    const newNiceId = generateNicePeerId(profile);

    console.log('🆕 Генерируем новый Nice Peer ID:', newNiceId);
    saveNicePeerIdToProfile(newNiceId);

    await initPeer();
    return newNiceId;
}

/**
 * Получить Nice ID для отображения
 */
export function getMyNicePeerId() {
    return currentNicePeerId || getSavedNicePeerId() || null;
}

/**
 * Получить историю real ID
 */
export function getRealPeerIdsHistory() {
    return getRealIdsHistory();
}

/**
 * Подключение по Nice ID (пробует все известные real ID)
 */
export async function connectByNiceId(niceId) {
    if (!niceId || !niceId.startsWith('@')) {
        throw new Error('Некорректный Nice ID');
    }

    const history = getRealIdsHistory();
    if (history.length === 0) {
        throw new Error('Нет сохранённых real ID для этого Nice ID');
    }

    console.log(`🔍 Пытаемся подключиться к ${niceId} через ${history.length} real ID...`);

    for (const realId of history) {
        try {
            console.log(`   → Попытка через: ${realId}`);
            const conn = await connectToPeer(realId);
            console.log(`✅ Успешное подключение к ${niceId} через ${realId}`);
            return conn;
        } catch (err) {
            console.warn(`   Не удалось через ${realId}: ${err.message}`);
        }
    }

    throw new Error(`Не удалось подключиться к ${niceId}. Попросите собеседника обновить страницу.`);
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

/* ====================== Базовые функции ====================== */

function setupConnection(conn) {
    const peerId = conn.peer;
    connections.set(peerId, conn);

    conn.on('data', (data) => {
        if (data.type === 'getProfile') {
            const myProfile = window.currentProfile || {};
            conn.send({ 
                type: 'profileResponse', 
                profile: myProfile,
                niceId: getMyNicePeerId()
            });
        }

        // Обычное сообщение
        if (data.type === 'message' && window.handleIncomingMessage) {
            window.handleIncomingMessage(peerId, data.message);
        }

        // === НОВОЕ: Статус "Печатает" ===
        if (data.type === 'typing' && window.handleIncomingMessage) {
            window.handleIncomingMessage(peerId, data);
        }
    });

    conn.on('close', () => connections.delete(peerId));
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

/**
 * Отправка статуса "Печатает" собеседнику
 */
export function sendTypingStatus(targetPeerId, isTyping) {
    const conn = connections.get(targetPeerId);
    if (!conn || !conn.open) return;

    conn.send({
        type: 'typing',
        isTyping: isTyping
    });
}

export { peer, connections };