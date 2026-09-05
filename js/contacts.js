import { applyTranslations, getTranslation } from './i18n.js';
import { connectToPeer } from './peer.js';

let contacts = [];

function loadContacts() {
    try {
        contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    } catch (e) {
        contacts = [];
    }
}

function saveContacts() {
    localStorage.setItem('contacts', JSON.stringify(contacts));
}

function avatarStyle(url) {
    return url
        ? `background-image:url('${url}');background-size:cover;background-position:center;`
        : 'background:linear-gradient(135deg,var(--accent),var(--lavender));';
}

function renderContacts() {
    const sidebarContent = document.getElementById('sidebar-content');
    if (!sidebarContent) return;

    const cards = contacts.map((contact, index) => {
        const fullName = [contact.surname, contact.name, contact.patronymic]
            .filter(Boolean).join(' ') || getTranslation('unknown-user');
        return `
            <div class="contact-card" data-real-id="${contact.realPeerId}">
                <div class="contact-avatar" style="${avatarStyle(contact.avatarUrl)}"></div>
                <div class="contact-info">
                    <div class="contact-name">${fullName}</div>
                </div>
                <button class="remove-contact-btn" data-index="${index}" title="${getTranslation('delete')}">✕</button>
            </div>`;
    }).join('');

    sidebarContent.innerHTML = `
        <button id="add-contact-btn" class="add-contact-main-btn">
            <span class="add-contact-icon">👤</span>
            <span class="add-contact-label" data-i18n="add-contact-button">${getTranslation('add-contact-button')}</span>
        </button>
        <div class="contacts-list">${cards}</div>
    `;

    applyTranslations();
    attachContactEvents();
}

window.renderContacts = renderContacts;

function attachContactEvents() {
    const addBtn = document.getElementById('add-contact-btn');
    if (addBtn) addBtn.addEventListener('click', openAddContactModal);

    document.querySelectorAll('.remove-contact-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopImmediatePropagation();
            removeContact(Number(e.currentTarget.dataset.index));
        });
    });

    document.querySelectorAll('.contact-card').forEach((card) => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.remove-contact-btn')) return;
            const realId = e.currentTarget.dataset.realId;
            const contact = contacts.find((c) => c.realPeerId === realId);
            if (contact) openChat(realId, contact);
        });
    });
}

function openChat(realPeerId, contact) {
    import('./chat.js')
        .then((module) => module.openChat(realPeerId, contact))
        .catch((err) => console.error('Ошибка открытия чата:', err));
}

function openAddContactModal() {
    const modal = document.getElementById('add-contact-modal');
    if (!modal) return;
    document.getElementById('search-result').style.display = 'none';
    document.getElementById('peer-search-input').value = '';
    modal.style.display = 'flex';
    applyTranslations();
}

async function searchPeer(inputStr) {
    const peerIdStr = (inputStr || '').trim();
    if (!peerIdStr) return;

    if (peerIdStr.startsWith('@')) {
        alert(getTranslation('peer-search-placeholder'));
        return;
    }

    const resultContainer = document.getElementById('search-result');
    resultContainer.style.display = 'none';

    try {
        const conn = await connectToPeer(peerIdStr);
        conn.send({ type: 'getProfile' });

        const remoteProfile = await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 7000);
            conn.on('data', (data) => {
                if (data.type === 'profileResponse') {
                    clearTimeout(timeout);
                    resolve(data.profile);
                }
            });
        }) || {};

        const avatar = document.getElementById('result-avatar');
        avatar.style.backgroundImage = remoteProfile.avatarUrl ? `url(${remoteProfile.avatarUrl})` : '';
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
        if (!remoteProfile.avatarUrl) {
            avatar.style.background = 'linear-gradient(135deg, var(--accent), var(--lavender))';
        }

        document.getElementById('result-name').textContent =
            [remoteProfile.surname, remoteProfile.name, remoteProfile.patronymic].filter(Boolean).join(' ')
            || getTranslation('default-username');
        document.getElementById('result-peer-id').textContent = peerIdStr;
        resultContainer.style.display = 'block';

        const addBtn = document.getElementById('add-contact-confirm-btn');
        const newBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newBtn, addBtn);
        newBtn.addEventListener('click', () => {
            addContact({
                realPeerId: peerIdStr,
                nicePeerId: remoteProfile.nicePeerId || remoteProfile.peerId || null,
                name: remoteProfile.name || '',
                surname: remoteProfile.surname || '',
                patronymic: remoteProfile.patronymic || '',
                avatarUrl: remoteProfile.avatarUrl || ''
            });
            document.getElementById('add-contact-modal').style.display = 'none';
        });
    } catch (err) {
        alert(err.message || getTranslation('peer-init-error'));
    }
}

function addContact(userData) {
    if (contacts.some((c) => c.realPeerId === userData.realPeerId)) return;
    contacts.push(userData);
    saveContacts();
    renderContacts();
}

function removeContact(index) {
    if (!confirm(getTranslation('delete') + '?')) return;
    contacts.splice(index, 1);
    saveContacts();
    renderContacts();
}

export function initContacts() {
    loadContacts();
    renderContacts();

    const modal = document.getElementById('add-contact-modal');
    const closeBtn = document.getElementById('add-contact-close');
    const searchBtn = document.getElementById('search-peer-btn');
    const searchInput = document.getElementById('peer-search-input');

    if (closeBtn) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => searchPeer(searchInput.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchPeer(searchInput.value);
        });
    }
}
