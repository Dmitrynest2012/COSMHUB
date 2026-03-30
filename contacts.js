// contacts.js — Полная версия с Nice ID + история real ID (до 10 шт.)

import { applyTranslations, getTranslation } from './i18n.js';
import { 
    connectByNiceId, 
    getMyNicePeerId, 
    getRealPeerIdsHistory 
} from './peer.js';

let contacts = [];

// ====================== Загрузка и сохранение контактов ======================
function loadContacts() {
    const saved = localStorage.getItem('contacts');
    contacts = saved ? JSON.parse(saved) : [];
}

function saveContacts() {
    localStorage.setItem('contacts', JSON.stringify(contacts));
}

// ====================== Рендер списка контактов ======================
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
            .filter(Boolean).join(' ') || getTranslation('unknown-user') || 'Неизвестный';

        const avatarStyle = contact.avatarUrl 
            ? `background-image: url(${contact.avatarUrl}); background-size: cover; background-position: center;` 
            : 'background: linear-gradient(135deg, #6b7ae3, #a78bfa);';

        // Показываем красивый Nice ID
        const displayId = contact.nicePeerId || contact.peerId || '—';

        html += `
            <div class="contact-card" data-nice-id="${contact.nicePeerId || ''}" data-real-id="${contact.realPeerId || ''}">
                <div class="contact-avatar" style="${avatarStyle}"></div>
                <div class="contact-info">
                    <div class="contact-name">${fullName}</div>
                    <div class="contact-peer-id">${displayId}</div>
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
    if (!isNaN(index)) removeContact(index);
}

function handleContactClick(e) {
    if (e.target.classList.contains('remove-contact-btn')) return;

    const niceId = e.currentTarget.dataset.niceId;
    const contact = contacts.find(c => c.nicePeerId === niceId);

    if (contact && niceId) {
        import('./chat.js')
            .then(module => {
                module.openChat(niceId, contact);   // передаём niceId
            })
            .catch(err => {
                console.error('Ошибка загрузки чата:', err);
                alert('Не удалось открыть чат');
            });
    }
}

// ====================== Модальное окно добавления ======================
function openAddContactModal() {
    const modal = document.getElementById('add-contact-modal');
    if (!modal) return;

    const searchResult = document.getElementById('search-result');
    if (searchResult) searchResult.style.display = 'none';

    const searchInput = document.getElementById('peer-search-input');
    if (searchInput) searchInput.value = '';

    modal.style.display = 'flex';
    applyTranslations();
}

// ====================== Поиск и добавление по Nice ID ======================
async function searchPeer(peerIdStr) {
    const trimmedId = (peerIdStr || '').trim();
    if (!trimmedId) {
        alert(getTranslation('enter-peer-id') || 'Введите Peer ID (начинается с @)');
        return;
    }

    if (!trimmedId.startsWith('@')) {
        alert('Nice ID должен начинаться с символа @');
        return;
    }

    console.log(`🔍 Поиск по Nice ID: ${trimmedId}`);

    const resultContainer = document.getElementById('search-result');
    if (resultContainer) resultContainer.style.display = 'none';

    try {
        // ←←← Главное изменение: используем connectByNiceId
        const conn = await connectByNiceId(trimmedId);

        console.log('✅ Соединение установлено с Nice ID:', trimmedId);

        // Запрашиваем профиль
        conn.send({ type: 'getProfile' });

        const profilePromise = new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 8000);

            conn.on('data', (data) => {
                if (data.type === 'profileResponse' && data.profile) {
                    clearTimeout(timeout);
                    resolve(data.profile);
                }
            });
        });

        const remoteProfile = await profilePromise;

        // Заполняем результат поиска
        const resultAvatar = document.getElementById('result-avatar');
        const resultName = document.getElementById('result-name');
        const resultPeerIdEl = document.getElementById('result-peer-id');
        const resultStatus = document.getElementById('result-status');
        const addBtn = document.getElementById('add-contact-confirm-btn');

        if (resultAvatar) {
            if (remoteProfile?.avatarUrl) {
                resultAvatar.style.backgroundImage = `url(${remoteProfile.avatarUrl})`;
                resultAvatar.style.backgroundSize = 'cover';
                resultAvatar.style.backgroundPosition = 'center';
            } else {
                resultAvatar.style.background = 'linear-gradient(135deg, #6b7ae3, #a78bfa)';
            }
        }

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
                    nicePeerId: trimmedId,                    // основной идентификатор
                    realPeerId: conn.peer,                    // последний успешный real ID
                    name: remoteProfile?.name || '',
                    surname: remoteProfile?.surname || '',
                    patronymic: remoteProfile?.patronymic || '',
                    avatarUrl: remoteProfile?.avatarUrl || ''
                });
                document.getElementById('add-contact-modal').style.display = 'none';
            });
        }

    } catch (err) {
        console.error('❌ Ошибка поиска по Nice ID:', err);
        const msg = err.message || getTranslation('peer-offline') || 'Пользователь не в сети или Nice ID неверный';
        alert(msg);
    }
}

// ====================== Добавление и удаление контактов ======================
function addContact(user) {
    // Проверяем по nicePeerId
    if (contacts.some(c => c.nicePeerId === user.nicePeerId)) {
        alert(getTranslation('contact-already-exists') || 'Этот контакт уже добавлен');
        return;
    }

    contacts.push(user);
    saveContacts();
    renderContacts();

    console.log('✅ Контакт добавлен:', user.nicePeerId);
}

function removeContact(index) {
    if (confirm(getTranslation('delete-contact-confirm') || 'Удалить контакт?')) {
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
    console.log('Мой Nice ID:', getMyNicePeerId());
    console.log('История real ID:', getRealPeerIdsHistory().length, 'шт.');
}