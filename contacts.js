// contacts.js — Полная версия с реальным PeerJS + интеграция с чатом

import { applyTranslations, getTranslation } from './i18n.js';
import { connectToPeer, getMyPeerId } from './peer.js';

let contacts = [];

// ====================== Загрузка и сохранение контактов ======================
function loadContacts() {
    const saved = localStorage.getItem('contacts');
    contacts = saved ? JSON.parse(saved) : [];
}

function saveContacts() {
    localStorage.setItem('contacts', JSON.stringify(contacts));
}

// ====================== Рендер списка контактов в сайдбаре ======================
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
            .filter(Boolean).join(' ') || getTranslation('unknown-user');

        const avatarStyle = contact.avatarUrl 
            ? `background-image: url(${contact.avatarUrl}); background-size: cover;` 
            : 'background: linear-gradient(135deg, #6b7ae3, #a78bfa);';

        html += `
            <div class="contact-card" data-peer-id="${contact.peerId}">
                <div class="contact-avatar" style="${avatarStyle}"></div>
                <div class="contact-info">
                    <div class="contact-name">${fullName}</div>
                    <div class="contact-peer-id">${contact.peerId}</div>
                </div>
                <button class="remove-contact-btn" data-index="${index}" title="${getTranslation('delete') || 'Удалить'}">✕</button>
            </div>
        `;
    });

    html += '</div>';
    sidebarContent.innerHTML = html;

    applyTranslations();
    attachContactEvents();
}

// ====================== Привязка событий ======================
function attachContactEvents() {
    const addBtn = document.getElementById('add-contact-btn');
    if (addBtn) {
        addBtn.removeEventListener('click', openAddContactModal);
        addBtn.addEventListener('click', openAddContactModal);
    }

    document.querySelectorAll('.remove-contact-btn').forEach(btn => {
        btn.removeEventListener('click', handleRemoveClick);
        btn.addEventListener('click', handleRemoveClick);
    });

    document.querySelectorAll('.contact-card').forEach(card => {
        card.removeEventListener('click', handleContactClick);
        card.addEventListener('click', handleContactClick);
    });
}

function handleRemoveClick(e) {
    e.stopImmediatePropagation();
    const index = parseInt(e.currentTarget.dataset.index);
    if (!isNaN(index)) {
        removeContact(index);
    }
}

function handleContactClick(e) {
    if (e.target.classList.contains('remove-contact-btn')) return;

    const peerId = e.currentTarget.dataset.peerId;
    const contact = contacts.find(c => c.peerId === peerId);

    if (contact) {
        import('./chat.js')
            .then(module => {
                module.openChat(peerId, contact);
            })
            .catch(err => {
                console.error('Ошибка загрузки модуля чата:', err);
                alert('Не удалось открыть чат');
            });
    }
}

// ====================== Открытие модального окна ======================
function openAddContactModal() {
    const modal = document.getElementById('add-contact-modal');
    if (!modal) {
        console.error('❌ Не найдено модальное окно #add-contact-modal');
        return;
    }

    const searchResult = document.getElementById('search-result');
    if (searchResult) searchResult.style.display = 'none';

    const searchInput = document.getElementById('peer-search-input');
    if (searchInput) searchInput.value = '';

    modal.style.display = 'flex';
    applyTranslations();
}

// ====================== РЕАЛЬНЫЙ ПОИСК С ОБМЕНОМ ПРОФИЛЯМИ ======================
async function searchPeer(peerIdStr) {
    const trimmedId = (peerIdStr || '').trim();
    if (!trimmedId) {
        alert(getTranslation('enter-peer-id') || 'Введите Peer ID');
        return;
    }

    console.log(`🔍 Поиск: пытаемся подключиться к Peer ID → ${trimmedId}`);

    const resultContainer = document.getElementById('search-result');
    if (resultContainer) resultContainer.style.display = 'none';

    try {
        const conn = await connectToPeer(trimmedId);

        console.log('✅ Соединение успешно установлено с:', trimmedId);

        // === ИСПРАВЛЕНИЕ: сразу запрашиваем профиль ===
        conn.send({ type: 'getProfile' });
        console.log('📤 Запрос профиля отправлен');

        // Ждём ответ с профилем
        const profilePromise = new Promise((resolve) => {
            let timeout = setTimeout(() => resolve(null), 5000);

            conn.on('data', (data) => {
                if (data.type === 'profileResponse' && data.profile) {
                    clearTimeout(timeout);
                    resolve(data.profile);
                }
            });
        });

        const remoteProfile = await profilePromise;

        // Заполняем карточку результата поиска
        const resultAvatar = document.getElementById('result-avatar');
        const resultName = document.getElementById('result-name');
        const resultPeerIdEl = document.getElementById('result-peer-id');
        const resultStatus = document.getElementById('result-status');
        const addBtn = document.getElementById('add-contact-confirm-btn');

        // Аватар
        if (resultAvatar) {
            if (remoteProfile && remoteProfile.avatarUrl) {
                resultAvatar.style.backgroundImage = `url(${remoteProfile.avatarUrl})`;
                resultAvatar.style.backgroundSize = 'cover';
                resultAvatar.style.backgroundPosition = 'center';
            } else {
                resultAvatar.style.backgroundImage = '';
                resultAvatar.style.background = 'linear-gradient(135deg, #6b7ae3, #a78bfa)';
            }
        }

        // Имя
        if (resultName) {
            const fullName = [
                remoteProfile?.surname,
                remoteProfile?.name,
                remoteProfile?.patronymic
            ].filter(Boolean).join(' ') || 'Пользователь онлайн';

            resultName.textContent = fullName;
        }

        if (resultPeerIdEl) resultPeerIdEl.textContent = trimmedId;

        if (resultStatus) {
            resultStatus.textContent = getTranslation('status-online') || 'В сети';
            resultStatus.className = 'status-text status-online';
        }

        if (resultContainer) resultContainer.style.display = 'block';

        // Кнопка "Добавить"
        if (addBtn) {
            const newAddBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newAddBtn, addBtn);

            newAddBtn.addEventListener('click', () => {
                addContact({
                    peerId: trimmedId,
                    name: remoteProfile?.name || '',
                    surname: remoteProfile?.surname || '',
                    patronymic: remoteProfile?.patronymic || '',
                    avatarUrl: remoteProfile?.avatarUrl || ''
                });
                document.getElementById('add-contact-modal').style.display = 'none';
            });
        }

    } catch (err) {
        console.error('❌ Ошибка поиска:', err);
        let msg = getTranslation('peer-offline') || 'Пользователь не в сети или Peer ID неверный';
        if (err.message) msg = err.message;
        alert(msg);
    }
}

// ====================== Добавление и удаление контактов ======================
function addContact(user) {
    if (contacts.some(c => c.peerId === user.peerId)) {
        alert(getTranslation('contact-already-exists') || 'Этот контакт уже добавлен');
        return;
    }

    contacts.push(user);
    saveContacts();
    renderContacts();
}

function removeContact(index) {
    if (confirm(getTranslation('delete-contact-confirm') || 'Удалить контакт?')) {
        contacts.splice(index, 1);
        saveContacts();
        renderContacts();
    }
}

// ====================== Инициализация модуля ======================
export function initContacts() {
    loadContacts();
    renderContacts();

    const modal = document.getElementById('add-contact-modal');
    const closeBtn = document.getElementById('add-contact-close');
    const searchBtn = document.getElementById('search-peer-btn');
    const searchInput = document.getElementById('peer-search-input');

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => searchPeer(searchInput.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchPeer(searchInput.value);
        });
    }

    console.log('%c✅ contacts.js инициализирован', 'color:#10b981; font-weight:700');
    console.log('Мой текущий Peer ID:', getMyPeerId());
}