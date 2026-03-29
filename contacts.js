// contacts.js — Управление контактами и добавлением по Peer ID

import { applyTranslations, getTranslation } from './i18n.js';

// Глобальные данные
let contacts = [];
const fakeUsersDatabase = new Map(); // Симуляция "сети" — база известных пользователей

// Добавляем несколько тестовых пользователей в "сеть" (для демонстрации поиска)
function initFakeDatabase() {
    const testUsers = [
        {
            peerId: "ABC12345-DEF1-GHI1",
            name: "Анна",
            surname: "Смирнова",
            patronymic: "Алексеевна",
            avatarUrl: "https://i.pravatar.cc/150?img=1",
            status: "online"
        },
        {
            peerId: "XYZ98765-ABC2-DEF2",
            name: "Дмитрий",
            surname: "Иванов",
            patronymic: "",
            avatarUrl: "https://i.pravatar.cc/150?img=2",
            status: "offline"
        },
        {
            peerId: "QWE55555-5555-5555",
            name: "Мария",
            surname: "Петрова",
            patronymic: "Владимировна",
            avatarUrl: "",
            status: "online"
        }
    ];

    testUsers.forEach(user => {
        fakeUsersDatabase.set(user.peerId, user);
    });
}

/**
 * Загрузка контактов из localStorage
 */
function loadContacts() {
    const saved = localStorage.getItem('contacts');
    if (saved) {
        contacts = JSON.parse(saved);
    }
}

/**
 * Сохранение контактов в localStorage
 */
function saveContacts() {
    localStorage.setItem('contacts', JSON.stringify(contacts));
}

/**
 * Рендер списка контактов в сайдбаре
 */
function renderContacts() {
    const sidebarContent = document.getElementById('sidebar-content');
    
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

    html += `</div>`;
    sidebarContent.innerHTML = html;

    // Важно: сразу после вставки HTML применяем переводы
    applyTranslations();

    attachContactEvents();
}

/**
 * Привязка событий к контактам
 */
function attachContactEvents() {
    // Кнопка "Добавить контакт"
    const addBtn = document.getElementById('add-contact-btn');
    if (addBtn) {
        addBtn.addEventListener('click', openAddContactModal);
    }

    // Кнопки удаления
    document.querySelectorAll('.remove-contact-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            if (!isNaN(index)) {
                removeContact(index);
            }
        });
    });

    // (Пока без открытия чата — можно добавить позже)
}

/**
 * Открытие модального окна добавления контакта
 */
function openAddContactModal() {
    const modal = document.getElementById('add-contact-modal');
    const searchResult = document.getElementById('search-result');
    
    // Сбрасываем результат поиска
    searchResult.style.display = 'none';
    document.getElementById('peer-search-input').value = '';
    
    modal.style.display = 'flex';
    applyTranslations();
}

/**
 * Поиск пользователя по Peer ID (симуляция P2P)
 */
function searchPeer(peerId) {
    const resultContainer = document.getElementById('search-result');
    const resultAvatar = document.getElementById('result-avatar');
    const resultName = document.getElementById('result-name');
    const resultPeerId = document.getElementById('result-peer-id');
    const resultStatus = document.getElementById('result-status');
    const addBtn = document.getElementById('add-contact-confirm-btn');

    const user = fakeUsersDatabase.get(peerId.trim());

    if (!user) {
        resultContainer.style.display = 'none';
        alert(getTranslation('peer-not-found') || 'Пользователь с таким Peer ID не найден.');
        return;
    }

    // Заполняем карточку
    const fullName = [user.surname, user.name, user.patronymic].filter(Boolean).join(' ');

    resultAvatar.style.backgroundImage = user.avatarUrl 
        ? `url(${user.avatarUrl})` 
        : '';
    resultAvatar.style.background = user.avatarUrl ? '' : 'linear-gradient(135deg, #6b7ae3, #a78bfa)';

    resultName.textContent = fullName;
    resultPeerId.textContent = user.peerId;
    
    resultStatus.textContent = user.status === 'online' 
        ? (getTranslation('status-online') || 'В сети')
        : (getTranslation('status-offline') || 'Не в сети');
    resultStatus.className = `status-text ${user.status === 'online' ? 'status-online' : 'status-offline'}`;

    resultContainer.style.display = 'block';

    // Кнопка "Добавить"
    addBtn.onclick = () => {
        addContact(user);
        document.getElementById('add-contact-modal').style.display = 'none';
    };
}

/**
 * Добавление контакта в список
 */
function addContact(user) {
    // Проверяем, нет ли уже такого контакта
    if (contacts.some(c => c.peerId === user.peerId)) {
        alert(getTranslation('contact-already-exists') || 'Этот контакт уже добавлен.');
        return;
    }

    contacts.push({
        peerId: user.peerId,
        name: user.name,
        surname: user.surname,
        patronymic: user.patronymic || '',
        avatarUrl: user.avatarUrl || ''
    });

    saveContacts();
    renderContacts();
}

/**
 * Удаление контакта
 */
function removeContact(index) {
    if (confirm(getTranslation('delete-contact-confirm') || 'Удалить контакт?')) {
        contacts.splice(index, 1);
        saveContacts();
        renderContacts();
    }
}

/**
 * Основная инициализация модуля контактов
 */
export function initContacts() {
    initFakeDatabase();
    loadContacts();
    renderContacts();

    // Закрытие модального окна добавления контакта
    const modal = document.getElementById('add-contact-modal');
    const closeBtn = document.getElementById('add-contact-close');
    const searchBtn = document.getElementById('search-peer-btn');
    const searchInput = document.getElementById('peer-search-input');

    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Поиск по кнопке
    searchBtn.addEventListener('click', () => {
        searchPeer(searchInput.value);
    });

    // Поиск по Enter
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchPeer(searchInput.value);
        }
    });

    console.log('%c✅ Модуль контактов инициализирован', 'color:#6b7ae3; font-weight:600');
}