// contacts.js — Полная версия с реальным PeerJS поиском

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
    // Кнопка "Добавить контакт"
    const addBtn = document.getElementById('add-contact-btn');
    if (addBtn) {
        addBtn.removeEventListener('click', openAddContactModal);
        addBtn.addEventListener('click', openAddContactModal);
    }

    // Кнопки удаления контактов
    document.querySelectorAll('.remove-contact-btn').forEach(btn => {
        btn.removeEventListener('click', handleRemoveClick);
        btn.addEventListener('click', handleRemoveClick);
    });
}

function handleRemoveClick(e) {
    e.stopImmediatePropagation();
    const index = parseInt(e.currentTarget.dataset.index);
    if (!isNaN(index)) {
        removeContact(index);
    }
}

// ====================== Открытие модального окна ======================
function openAddContactModal() {
    const modal = document.getElementById('add-contact-modal');
    if (!modal) {
        console.error('❌ Не найдено модальное окно #add-contact-modal');
        return;
    }

    // Сбрасываем результаты предыдущего поиска
    const searchResult = document.getElementById('search-result');
    if (searchResult) searchResult.style.display = 'none';

    const searchInput = document.getElementById('peer-search-input');
    if (searchInput) searchInput.value = '';

    modal.style.display = 'flex';
    applyTranslations();
}

// ====================== РЕАЛЬНЫЙ ПОИСК ПО PEER ID ======================
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
        console.log('⏳ Устанавливаем соединение через PeerJS...');

        const conn = await connectToPeer(trimmedId);

        console.log('✅ Соединение успешно установлено с:', trimmedId);

        // Заполняем карточку результата
        const resultAvatar = document.getElementById('result-avatar');
        const resultName = document.getElementById('result-name');
        const resultPeerIdEl = document.getElementById('result-peer-id');
        const resultStatus = document.getElementById('result-status');
        const addBtn = document.getElementById('add-contact-confirm-btn');

        if (resultAvatar) {
            resultAvatar.style.background = 'linear-gradient(135deg, #6b7ae3, #a78bfa)';
        }
        if (resultName) resultName.textContent = 'Пользователь онлайн';
        if (resultPeerIdEl) resultPeerIdEl.textContent = trimmedId;
        if (resultStatus) {
            resultStatus.textContent = getTranslation('status-online') || 'В сети';
            resultStatus.className = 'status-text status-online';
        }

        if (resultContainer) resultContainer.style.display = 'block';

        // Кнопка "Добавить" — сбрасываем предыдущие обработчики
        if (addBtn) {
            const newAddBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newAddBtn, addBtn);

            newAddBtn.addEventListener('click', () => {
                addContact({
                    peerId: trimmedId,
                    name: 'Пользователь',
                    surname: '',
                    patronymic: '',
                    avatarUrl: ''
                });
                document.getElementById('add-contact-modal').style.display = 'none';
            });
        }

    } catch (err) {
        console.error('❌ Ошибка поиска:', err);
        console.error('Тип ошибки:', err.type || 'unknown');
        console.error('Сообщение:', err.message);

        let userMessage = getTranslation('peer-not-found') || 'Не удалось найти пользователя';

        if (err.message?.includes('timeout') || err.type === 'peer-unavailable') {
            userMessage = getTranslation('peer-offline') || 'Пользователь не в сети или Peer ID неверный';
        } else if (err.message) {
            userMessage = err.message;
        }

        alert(userMessage);
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

    // Обработчики модального окна
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

    // Поиск
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => searchPeer(searchInput.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchPeer(searchInput.value);
        });
    }

    // Диагностика
    console.log('%c✅ contacts.js инициализирован', 'color:#10b981; font-weight:700');
    console.log('Мой текущий Peer ID:', getMyPeerId());
}