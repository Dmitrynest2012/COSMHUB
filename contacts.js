// contacts.js — Реальный поиск по PeerJS

import { applyTranslations, getTranslation } from './i18n.js';
import { connectToPeer, getMyPeerId } from './peer.js';

let contacts = [];

/**
 * Загрузка / сохранение контактов
 */
function loadContacts() {
    const saved = localStorage.getItem('contacts');
    contacts = saved ? JSON.parse(saved) : [];
}

function saveContacts() {
    localStorage.setItem('contacts', JSON.stringify(contacts));
}

/**
 * Рендер контактов в сайдбаре
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

    html += '</div>';
    sidebarContent.innerHTML = html;

    applyTranslations();
    attachContactEvents();
}

function attachContactEvents() { /* остаётся как было раньше */ }

/**
 * Открытие модального окна
 */
function openAddContactModal() {
    const modal = document.getElementById('add-contact-modal');
    document.getElementById('search-result').style.display = 'none';
    document.getElementById('peer-search-input').value = '';
    modal.style.display = 'flex';
    applyTranslations();
}

/**
 * РЕАЛЬНЫЙ ПОИСК ПО PEER ID
 */
async function searchPeer(peerId) {
    const resultContainer = document.getElementById('search-result');
    const resultAvatar = document.getElementById('result-avatar');
    const resultName = document.getElementById('result-name');
    const resultPeerIdEl = document.getElementById('result-peer-id');
    const resultStatus = document.getElementById('result-status');
    const addBtn = document.getElementById('add-contact-confirm-btn');

    try {
        const conn = await connectToPeer(peerId.trim());
        
        // Запрашиваем профиль у удалённого пользователя
        conn.send({ type: 'getProfile' });

        // Пока что показываем как "В сети" (в будущем можно получать реальный профиль)
        resultAvatar.style.background = 'linear-gradient(135deg, #6b7ae3, #a78bfa)';
        resultName.textContent = 'Пользователь онлайн';
        resultPeerIdEl.textContent = peerId;
        resultStatus.textContent = getTranslation('status-online') || 'В сети';
        resultStatus.className = 'status-text status-online';

        resultContainer.style.display = 'block';

        addBtn.onclick = () => {
            // Добавляем контакт (можно потом улучшить — получать реальные данные профиля)
            addContact({
                peerId: peerId,
                name: 'Пользователь',
                surname: '',
                patronymic: '',
                avatarUrl: ''
            });
            document.getElementById('add-contact-modal').style.display = 'none';
        };

    } catch (err) {
        resultContainer.style.display = 'none';
        const msg = err.message === 'timeout' 
            ? (getTranslation('peer-offline') || 'Пользователь не в сети или ID неверный')
            : (getTranslation('peer-not-found') || 'Не удалось найти пользователя');
        alert(msg);
    }
}

/**
 * Добавление контакта
 */
function addContact(user) {
    if (contacts.some(c => c.peerId === user.peerId)) {
        alert(getTranslation('contact-already-exists') || 'Контакт уже добавлен');
        return;
    }
    contacts.push(user);
    saveContacts();
    renderContacts();
}

function removeContact(index) { /* как было */ }

/**
 * Инициализация
 */
export function initContacts() {
    loadContacts();
    renderContacts();

    // Закрытие модального окна...
    const modal = document.getElementById('add-contact-modal');
    const closeBtn = document.getElementById('add-contact-close');
    const searchBtn = document.getElementById('search-peer-btn');
    const searchInput = document.getElementById('peer-search-input');

    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

    searchBtn.addEventListener('click', () => searchPeer(searchInput.value));
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') searchPeer(searchInput.value);
    });

    console.log('%c✅ Реальный PeerJS модуль контактов инициализирован', 'color:#10b981; font-weight:700');
}