let peer = null;
let currentRealPeerId = null;
let currentNicePeerId = null;
let connections = new Map();
let reconnectTimer = null;

const MAX_REAL_IDS_HISTORY = 10;

function transliterate(text) {
    const map = {
        а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',
        н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',
        ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
        А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ё:'Yo',Ж:'Zh',З:'Z',И:'I',Й:'Y',К:'K',Л:'L',М:'M',
        Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',Х:'H',Ц:'C',Ч:'Ch',Ш:'Sh',Щ:'Sch',
        Ъ:'',Ы:'Y',Ь:'',Э:'E',Ю:'Yu',Я:'Ya'
    };
    return text.split('').map((ch) => map[ch] || ch).join('')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function generateSuffix() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

function generateNicePeerId(profile) {
    let login = '';
    if (profile.surname || profile.name) {
        login = transliterate(`${profile.surname || ''} ${profile.name || ''}`.trim());
    }
    if (!login || login.length < 2) login = 'user';
    if (login.length > 20) login = login.slice(0, 20);
    return `@${login}-${generateSuffix()}`;
}

function getSavedNicePeerId() {
    try {
        const saved = localStorage.getItem('profile');
        return saved ? (JSON.parse(saved).nicePeerId || null) : null;
    } catch (e) {
        return null;
    }
}

function saveNicePeerIdToProfile(niceId) {
    let profile = {};
    try {
        const saved = localStorage.getItem('profile');
        if (saved) profile = JSON.parse(saved);
    } catch (e) {}
    profile.nicePeerId = niceId;
    localStorage.setItem('profile', JSON.stringify(profile));
    currentNicePeerId = niceId;
    window.currentProfile = profile;
}

function getRealIdsHistory() {
    try {
        return JSON.parse(localStorage.getItem('realPeerIdsHistory') || '[]');
    } catch (e) {
        return [];
    }
}

function saveRealIdToHistory(realId) {
    if (!realId) return;
    const history = [realId, ...getRealIdsHistory().filter((id) => id !== realId)]
        .slice(0, MAX_REAL_IDS_HISTORY);
    localStorage.setItem('realPeerIdsHistory', JSON.stringify(history));
}

function createPeer() {
    return new Peer({
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        debug: 1,
        pingInterval: 5000,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });
}

export function initPeer() {
    return new Promise((resolve) => {
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
            window.peer = peer;
            window.myRealPeerId = id;
            window.myNicePeerId = currentNicePeerId;
            resolve(id);
        });

        peer.on('error', (err) => {
            if (err.type === 'network' || err.type === 'server-error') attemptReconnect();
        });

        peer.on('disconnected', attemptReconnect);

        peer.on('connection', (conn) => {
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

function setupConnection(conn) {
    const peerId = conn.peer;
    connections.set(peerId, conn);

    conn.on('open', () => {
        conn.send({
            type: 'hello',
            myRealId: window.myRealPeerId,
            niceId: currentNicePeerId
        });
    });

    conn.on('data', (data) => {
        if (data.type === 'hello') {
            ensureConnection(peerId).catch(() => {});
        }
        if (data.type === 'getProfile') {
            conn.send({
                type: 'profileResponse',
                profile: window.currentProfile || {},
                niceId: currentNicePeerId
            });
        }
        if ((data.type === 'message' || data.type === 'typing') && window.handleIncomingMessage) {
            window.handleIncomingMessage(peerId, data);
        }
    });

    conn.on('error', () => connections.delete(peerId));
    conn.on('close', () => connections.delete(peerId));
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
                reject(new Error('Таймаут подключения (15 сек)'));
            }
        }, 15000);
    });
}

export async function ensureConnection(targetPeerId) {
    const existing = connections.get(targetPeerId);
    if (existing && existing.open) return existing;
    return connectToPeer(targetPeerId);
}

export function sendMessage(targetPeerId, text) {
    const conn = connections.get(targetPeerId);
    if (!conn || !conn.open) return false;
    conn.send({ type: 'message', message: { text, timestamp: Date.now() } });
    return true;
}

export function sendTypingStatus(targetPeerId, isTyping) {
    const conn = connections.get(targetPeerId);
    if (!conn || !conn.open) return;
    conn.send({ type: 'typing', isTyping });
}

export { peer, connections, generateNicePeerId, saveNicePeerIdToProfile };
