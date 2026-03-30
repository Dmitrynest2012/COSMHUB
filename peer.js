// peer.js — Nice ID + улучшенная надёжность соединений + bidirectional handshake

let peer = null;
let currentRealPeerId = null;
let currentNicePeerId = null;
let connections = new Map();
let reconnectTimer = null;

const MAX_REAL_IDS_HISTORY = 10;

/**
 * Транслитерация для генерации Nice ID
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
        .replace(/[^a-z0-9]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function generateSuffix() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

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

/* ====================== Nice ID ====================== */

function getSavedNicePeerId() {
    const saved = localStorage.getItem('profile');
    if (saved) {
        try { return JSON.parse(saved).nicePeerId || null; } catch (e) {}
    }
    return null;
}

function saveNicePeerIdToProfile(niceId) {
    let profile = {};
    const saved = localStorage.getItem('profile');
    if (saved) try { profile = JSON.parse(saved); } catch (e) {}
    
    profile.nicePeerId = niceId;
    localStorage.setItem('profile', JSON.stringify(profile));
    currentNicePeerId = niceId;
    window.currentProfile = profile;
}

/* ====================== История Real ID ====================== */

function getRealIdsHistory() {
    const saved = localStorage.getItem('realPeerIdsHistory');
    return saved ? JSON.parse(saved) : [];
}

function saveRealIdToHistory(realId) {
    if (!realId) return;
    let history = getRealIdsHistory();
    history = history.filter(id => id !== realId);
    history.unshift(realId);
    history = history.slice(0, MAX_REAL_IDS_HISTORY);
    localStorage.setItem('realPeerIdsHistory', JSON.stringify(history));
}

/* ====================== PeerJS ====================== */

function createPeer() {
    return new Peer({
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
    });
}

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

            console.log('%c✅ PeerJS подключён', 'color:#10b981; font-weight:700');
            console.log('   Real ID:', id);
            console.log('   Nice ID:', currentNicePeerId || 'не задан');

            window.peer = peer;
            window.myRealPeerId = id;
            window.myNicePeerId = currentNicePeerId;

            resolve(id);
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err.type, err.message);
            if (err.type === 'network' || err.type === 'server-error') {
                attemptReconnect();
            }
        });

        peer.on('disconnected', () => {
            console.warn('Peer disconnected — reconnecting...');
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
        if (peer && !peer.destroyed) peer.reconnect();
    }, 5000);
}

/* ====================== Основная функция соединения ====================== */

function setupConnection(conn) {
    const peerId = conn.peer;
    connections.set(peerId, conn);

    console.log(`🔗 Настраиваем соединение с ${peerId}`);

    // Важно: обработка открытия соединения для ВСЕХ подключений
    conn.on('open', () => {
        console.log(`✅ Соединение полностью открыто (bidirectional) с ${peerId}`);
        
        // Отправляем приветствие, чтобы вторая сторона тоже могла подключиться
        conn.send({
            type: 'hello',
            myRealId: window.myRealPeerId,
            niceId: currentNicePeerId
        });
    });

    conn.on('data', (data) => {
        console.log(`📥 Данные от ${peerId}:`, data);

        if (data.type === 'hello') {
            console.log(`👋 Получено приветствие от ${peerId}`);
            // Если у нас ещё нет активного соединения в обратную сторону — подключаемся
            ensureConnection(peerId).catch(() => {});
        }

        if (data.type === 'getProfile') {
            const myProfile = window.currentProfile || {};
            conn.send({
                type: 'profileResponse',
                profile: myProfile,
                niceId: currentNicePeerId
            });
        }

        if (data.type === 'message' && window.handleIncomingMessage) {
            window.handleIncomingMessage(peerId, data);
        }

        if (data.type === 'typing' && window.handleIncomingMessage) {
            window.handleIncomingMessage(peerId, data);
        }
    });

    conn.on('error', (err) => {
        console.error(`❌ Ошибка соединения ${peerId}:`, err);
        connections.delete(peerId);
    });

    conn.on('close', () => {
        console.warn(`🔌 Соединение закрыто с ${peerId}`);
        connections.delete(peerId);
    });
}

export function connectToPeer(targetPeerId) {
    return new Promise((resolve, reject) => {
        if (!peer || peer.destroyed) {
            return reject(new Error('PeerJS не инициализирован'));
        }

        console.log(`🔌 Пытаемся подключиться к ${targetPeerId}`);

        const conn = peer.connect(targetPeerId, {
            reliable: true,
            serialization: 'json'
        });

        let resolved = false;

        conn.on('open', () => {
            if (resolved) return;
            resolved = true;
            console.log(`✅ Исходящее соединение открыто с ${targetPeerId}`);
            setupConnection(conn);
            resolve(conn);
        });

        conn.on('error', (err) => {
            if (!resolved) {
                resolved = true;
                console.error(`❌ Ошибка подключения к ${targetPeerId}:`, err);
                reject(err);
            }
        });

        // Таймаут
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                conn.close();
                reject(new Error('Таймаут подключения (15 сек)'));
            }
        }, 15000);
    });
}

export async function ensureConnection(targetPeerId) {
    let conn = connections.get(targetPeerId);
    if (conn && conn.open) return conn;

    try {
        conn = await connectToPeer(targetPeerId);
        return conn;
    } catch (err) {
        console.error('Не удалось установить соединение с', targetPeerId, err);
        throw err;
    }
}

export function sendMessage(targetPeerId, text) {
    const conn = connections.get(targetPeerId);
    if (!conn || !conn.open) {
        console.warn('❌ Нет открытого соединения для отправки сообщения →', targetPeerId);
        return false;
    }

    console.log(`📤 Отправка сообщения → ${targetPeerId}: "${text}"`);

    conn.send({
        type: 'message',
        message: {
            text,
            timestamp: Date.now()
        }
    });

    return true;
}

export function sendTypingStatus(targetPeerId, isTyping) {
    const conn = connections.get(targetPeerId);
    if (!conn || !conn.open) return;

    conn.send({ type: 'typing', isTyping });
}

export { peer, connections };