// peer.js — стабильная версия с приоритетом сохранённого @ID + fallback

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
 * Генерация красивого Peer ID: @login-suffix
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

/**
 * Получаем сохранённый Peer ID из профиля
 */
function getSavedPeerId() {
    const saved = localStorage.getItem('profile');
    if (saved) {
        try {
            const profile = JSON.parse(saved);
            return profile.peerId || null;
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
        try { profile = JSON.parse(saved); } catch (e) {}
    }

    profile.peerId = newId;
    localStorage.setItem('profile', JSON.stringify(profile));
    window.currentProfile = profile;
    currentPeerId = newId;
}

/**
 * Создание Peer
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
        console.log('🔄 Пытаемся использовать сохранённый Peer ID:', id);
    } else {
        console.log('🆕 Создаём Peer без фиксированного ID (PeerJS выдаст временный)');
    }

    return new Peer(peerOptions);
}

/**
 * Инициализация PeerJS с приоритетом сохранённого ID + fallback
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

        let triedWithSaved = false;

        function start(useSavedId) {
            triedWithSaved = useSavedId;
            const idToUse = useSavedId ? savedId : null;

            peer = createPeer(idToUse);

            peer.on('open', (id) => {
                currentPeerId = id;
                console.log('%c✅ PeerJS подключён! Peer ID:', 'color:#10b981; font-weight:700', id);

                // Сохраняем только если это действительно новый ID
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

                if (err.type === 'unavailable-id' && triedWithSaved && savedId) {
                    console.warn('⚠️ Сохранённый ID временно занят — используем fallback (временный ID)');
                    // Пробуем создать без указания ID
                    start(false);
                    return;
                }

                if (err.type === 'network' || err.type === 'server-error') {
                    attemptReconnect();
                } else {
                    reject(err);
                }
            });

            peer.on('disconnected', () => {
                console.warn('⚠️ Peer отключён — пытаемся reconnect...');
                try { peer.reconnect(); } catch (e) {}
            });

            peer.on('connection', (conn) => {
                console.log('📥 Входящее соединение от', conn.peer);
                setupConnection(conn);
            });
        }

        // Начинаем с попытки использовать сохранённый ID
        start(!!savedId);
    });
}

/**
 * Генерация нового красивого Peer ID (только по кнопке)
 */
export async function generateNewPeerId() {
    const profile = window.currentProfile || {};
    let newPeerId = generateNicePeerId(profile);

    console.log('🆕 Генерируем новый красивый Peer ID:', newPeerId);

    savePeerIdToProfile(newPeerId);   // сразу сохраняем

    try {
        await initPeer();             // теперь initPeer увидит новый сохранённый ID
        return currentPeerId;
    } catch (err) {
        console.error('Ошибка при инициализации с новым ID:', err);
        // Если даже новый ID не прошёл — пробуем ещё раз с другим суффиксом
        newPeerId = generateNicePeerId(profile);
        savePeerIdToProfile(newPeerId);
        await initPeer();
        return currentPeerId;
    }
}

/**
 * Получить текущий Peer ID (для отображения)
 */
export function getMyPeerId() {
    return currentPeerId || getSavedPeerId() || null;
}

/**
 * Реконнект
 */
function attemptReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        if (peer && !peer.destroyed) peer.reconnect();
    }, 5000);
}

// === Остальные функции без изменений ===
export async function ensureConnection(targetPeerId) { /* ... */ }
export function connectToPeer(targetPeerId) { /* ... */ }

function setupConnection(conn) { /* ... */ }

export function sendMessage(targetPeerId, text) { /* ... */ }

export { peer, connections };