// contacts.js — Исправленная версия с надёжным обработчиком кнопки "Добавить контакт"

import { applyTranslations, getTranslation } from './i18n.js';
import { connectToPeer } from './peer.js';

let contacts = [];

// ====================== Загрузка / сохранение ======================
function loadContacts() {
    const saved = localStorage.getItem('contacts');
    contacts = saved ? JSON.parse(saved) : [];
}

function saveContacts() {
    localStorage.setItem('contacts', JSON.stringify(contacts));
}

// ====================== Рендер сайдбара ======================
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

    // Применяем переводы
    applyTranslations();

    // Важно: вешаем обработчики ПОСЛЕ вставки HTML
    attachContactEvents();
}

// ====================== Обработчики событий ======================
function attachContactEvents() {
    // Кнопка "Добавить контакт" — используем делегирование + проверку
    const addBtn = document.getElementById('add-contact-btn');
    if (addBtn) {
        // Удаляем старый обработчик, если был (защита от дублей)
        addBtn.removeEventListener('click', openAddContactModal);
        addBtn.addEventListener('click', openAddContactModal);
    }

    // Кнопки удаления контактов
    document.querySelectorAll('.remove-contact-btn').forEach(btn => {
        btn.removeEventListener('click', handleRemoveClick); // защита от дублей
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

// ====================== Модальное окно ======================
function openAddContactModal() {
    const modal = document.getElementById('add-contact-modal');
    if (!modal) {
        console.error('Модальное окно #add-contact-modal не найдено!');
        return;
    }

    // Сбрасываем предыдущий поиск
    const searchResult = document.getElementById('search-result');
    if (searchResult) searchResult.style.display = 'none';

    const searchInput = document.getElementById('peer-search-input');
    if (searchInput) searchInput.value = '';

    modal.style.display = 'flex';
    applyTranslations();
}

// ====================== Поиск (оставляем как было) ======================
async function searchPeer(peerIdStr) {
    const trimmedId = peerIdStr.trim();
    if (!trimmedId) {
        alert(getTranslation('enter-peer-id') || 'Введите Peer ID');
        return;
    }

    // ... остальной код поиска без изменений (из предыдущей версии) ...
    // (я оставил его коротко, вставь сюда свой актуальный searchPeer)
}

// Добавление и удаление контактов (без изменений)
function addContact(user) { /* как было раньше */ }
function removeContact(index) { /* как было раньше */ }

// ====================== Инициализация ======================
export function initContacts() {
    loadContacts();
    renderContacts();   // первый рендер

    // Обработчики закрытия модального окна
    const modal = document.getElementById('add-contact-modal');
    const closeBtn = document.getElementById('add-contact-close');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    // Поиск по кнопке и Enter
    const searchBtn = document.getElementById('search-peer-btn');
    const searchInput = document.getElementById('peer-search-input');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => searchPeer(searchInput.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchPeer(searchInput.value);
        });
    }

    console.log('%c✅ contacts.js инициализирован (кнопка Добавить контакт должна работать)', 'color:#10b981; font-weight:700');
}