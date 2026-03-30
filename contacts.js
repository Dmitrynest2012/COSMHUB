// contacts.js — Управление контактами (упрощённый вид карточек)

import { applyTranslations, getTranslation } from './i18n.js';

let contacts = [];

// ====================== Загрузка / Сохранение ======================
function loadContacts() {
    const saved = localStorage.getItem('contacts');
    contacts = saved ? JSON.parse(saved) : [];
}

function saveContacts() {
    localStorage.setItem('contacts', JSON.stringify(contacts));
}

// ====================== Рендер контактов ======================
function renderContacts() {
    const sidebarContent = document.getElementById('sidebar-content');
    if (!sidebarContent) return;

    let html = `
        <button id="add-contact-btn" class="add-contact-main-btn" data-i18n="add-contact-button">
            👤 <span data-i18n="add-contact-button">Добавить контакт</span>
        </button>
        
        <div class="contacts-list">
    `;

    contacts.forEach((contact, index) => {
        const fullName = [contact.surname, contact.name, contact.patronymic]
            .filter(Boolean).join(' ') || 'Неизвестный пользователь';

        const avatarStyle = contact.avatarUrl 
            ? `background-image: url(${contact.avatarUrl}); background-size: cover; background-position: center;` 
            : 'background: linear-gradient(135deg, #6b7ae3, #a78bfa);';

        html += `
            <div class="contact-card" data-real-id="${contact.realPeerId}">
                <div class="contact-avatar" style="${avatarStyle}"></div>
                <div class="contact-info">
                    <div class="contact-name">${fullName}</div>
                </div>
                <button class="remove-contact-btn" data-index="${index}" title="Удалить контакт">✕</button>
            </div>
        `;
    });

    html += '</div>';
    sidebarContent.innerHTML = html;

    applyTranslations();
    attachContactEvents();
}

// ====================== События ======================
function attachContactEvents() {
    const addBtn = document.getElementById('add-contact-btn');
    if (addBtn) addBtn.addEventListener('click', openAddContactModal);

    // Кнопки удаления
    document.querySelectorAll('.remove-contact-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopImmediatePropagation();
            removeContact(parseInt(e.currentTarget.dataset.index));
        });
    });

    // Открытие чата по клику на карточку
    document.querySelectorAll('.contact-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-contact-btn')) return;
            
            const realId = e.currentTarget.dataset.realId;
            const contact = contacts.find(c => c.realPeerId === realId);
            if (contact) {
                openChat(realId, contact);
            }
        });
    });
}

function openChat(realPeerId, contact) {
    import('./chat.js')
        .then(module => module.openChat(realPeerId, contact))
        .catch(err => console.error('Ошибка открытия чата:', err));
}

// ====================== Модальное окно добавления контакта ======================
function openAddContactModal() {
    const modal = document.getElementById('add-contact-modal');
    if (!modal) return;

    document.getElementById('search-result').style.display = 'none';
    document.getElementById('peer-search-input').value = '';
    modal.style.display = 'flex';
    applyTranslations();
}

// ====================== Поиск по REAL Peer ID ======================
async function searchPeer(inputStr) {
    const peerIdStr = (inputStr || '').trim();
    if (!peerIdStr) {
        alert('Введите Peer ID друга');
        return;
    }

    // Предупреждение, если случайно ввели Nice ID
    if (peerIdStr.startsWith('@')) {
        alert('Введите РЕАЛЬНЫЙ Peer ID друга (длинная строка без @).\n\nДруг может скопировать его из своего профиля.');
        return;
    }

    console.log(`🔍 Поиск по real Peer ID: ${peerIdStr}`);

    const resultContainer = document.getElementById('search-result');
    resultContainer.style.display = 'none';

    try {
        const conn = await connectToPeer(peerIdStr);   // из peer.js

        conn.send({ type: 'getProfile' });

        const profilePromise = new Promise(resolve => {
            const timeout = setTimeout(() => resolve(null), 7000);
            conn.on('data', data => {
                if (data.type === 'profileResponse') {
                    clearTimeout(timeout);
                    resolve(data.profile);
                }
            });
        });

        const remoteProfile = await profilePromise || {};

        // Заполняем результат поиска
        document.getElementById('result-avatar').style.backgroundImage = remoteProfile.avatarUrl 
            ? `url(${remoteProfile.avatarUrl})` 
            : '';
        document.getElementById('result-avatar').style.background = remoteProfile.avatarUrl ? '' : 'linear-gradient(135deg, #6b7ae3, #a78bfa)';

        document.getElementById('result-name').textContent = 
            [remoteProfile.surname, remoteProfile.name, remoteProfile.patronymic].filter(Boolean).join(' ') || 'Пользователь';

        document.getElementById('result-peer-id').textContent = peerIdStr;

        resultContainer.style.display = 'block';

        // Кнопка "Добавить"
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
        console.error(err);
        alert(err.message || 'Не удалось подключиться. Убедитесь, что друг онлайн и передал правильный Real Peer ID.');
    }
}

// ====================== Добавление и удаление контакта ======================
function addContact(userData) {
    if (contacts.some(c => c.realPeerId === userData.realPeerId)) {
        alert('Этот контакт уже добавлен');
        return;
    }

    contacts.push(userData);
    saveContacts();
    renderContacts();
}

function removeContact(index) {
    if (confirm('Удалить этот контакт?')) {
        contacts.splice(index, 1);
        saveContacts();
        renderContacts();
    }
}

// ====================== Инициализация ======================
export function initContacts() {
    loadContacts();
    renderContacts();

    const modal = document.getElementById('add-contact-modal');
    const closeBtn = document.getElementById('add-contact-close');
    const searchBtn = document.getElementById('search-peer-btn');
    const searchInput = document.getElementById('peer-search-input');

    if (closeBtn) closeBtn.addEventListener('click', () => modal.style.display = 'none');
    if (modal) modal.addEventListener('click', e => { 
        if (e.target === modal) modal.style.display = 'none'; 
    });

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => searchPeer(searchInput.value));
        searchInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') searchPeer(searchInput.value);
        });
    }

    console.log('%c✅ contacts.js инициализирован', 'color:#10b981; font-weight:700');
}