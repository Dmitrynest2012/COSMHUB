// profile.js — Редактирование профиля

import { applyTranslations, getTranslation } from './i18n.js';
import { initPeer, getMyPeerId } from './peer.js';

// Глобальная переменная для хранения данных профиля
let currentProfile = {};

/**
 * Генерирует реалистичный Peer ID (для будущего P2P/WebRTC чата)
 */


/**
 * Основная инициализация профиля
 */
export function initProfile() {
    const avatarHeader = document.getElementById('header-avatar');
    const userBlock = document.getElementById('user-block');
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.getElementById('modal-close');
    const saveBtn = document.getElementById('save-profile-btn');
    const generateBtn = document.getElementById('generate-peer-id');

    // Загрузка сохранённого профиля
    const saved = localStorage.getItem('profile');
    if (saved) {
        currentProfile = JSON.parse(saved);
        renderHeaderProfile();
    }

    // Открытие модального окна
    avatarHeader.addEventListener('click', () => openProfileModal());
    userBlock.addEventListener('click', (e) => {
        if (e.target.id !== 'menu-toggle') openProfileModal();
    });

    // Закрытие окна
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Предпросмотр аватара
    const urlInput = document.getElementById('avatar-url-input');
    const preview = document.getElementById('preview-avatar');
    urlInput.addEventListener('input', () => {
        const url = urlInput.value.trim();
        if (url) {
            preview.style.backgroundImage = `url(${url})`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
        } else {
            preview.style.backgroundImage = '';
            preview.style.background = 'linear-gradient(135deg, #6b7ae3, #a78bfa)';
        }
    });

    // Генерация Peer ID
    generateBtn.addEventListener('click', () => {
        const peerIdInput = document.getElementById('profile-peer-id');
        const newId = generatePeerId();
        peerIdInput.value = newId;
    });

    // Сохранение профиля
    saveBtn.addEventListener('click', saveProfile);
}

/**
 * Открывает модальное окно и заполняет все поля
 */
function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    const urlInput = document.getElementById('avatar-url-input');
    const preview = document.getElementById('preview-avatar');
    const peerIdInput = document.getElementById('profile-peer-id');

    // Заполняем обычные поля
    document.getElementById('profile-name').value = currentProfile.name || '';
    document.getElementById('profile-surname').value = currentProfile.surname || '';
    document.getElementById('profile-patronymic').value = currentProfile.patronymic || '';
    document.getElementById('profile-gender').value = currentProfile.gender || 'male';
    document.getElementById('profile-birthdate').value = currentProfile.birthdate || '';
    
    // Пиринг ID
    peerIdInput.value = currentProfile.peerId || '';

    // URL аватара
    urlInput.value = currentProfile.avatarUrl || '';

    // Превью аватарки
    if (currentProfile.avatarUrl) {
        preview.style.backgroundImage = `url(${currentProfile.avatarUrl})`;
        preview.style.backgroundSize = 'cover';
    } else {
        preview.style.backgroundImage = '';
        preview.style.background = 'linear-gradient(135deg, #6b7ae3, #a78bfa)';
    }

    modal.style.display = 'flex';

    // Применяем переводы (включая placeholder и текст кнопки)
    applyTranslations();
}

/**
 * Сохраняет профиль и делает данные глобально доступными
 */
function saveProfile() {
    currentProfile = {
        name: document.getElementById('profile-name').value.trim(),
        surname: document.getElementById('profile-surname').value.trim(),
        patronymic: document.getElementById('profile-patronymic').value.trim(),
        gender: document.getElementById('profile-gender').value,
        birthdate: document.getElementById('profile-birthdate').value,
        avatarUrl: document.getElementById('avatar-url-input').value.trim(),
        peerId: document.getElementById('profile-peer-id').value.trim()
    };

    localStorage.setItem('profile', JSON.stringify(currentProfile));
    window.currentProfile = currentProfile;   // Глобальная переменная

    renderHeaderProfile();
    document.getElementById('profile-modal').style.display = 'none';
}

/**
 * Обновляет информацию в хедере
 */
function renderHeaderProfile() {
    const usernameEl = document.getElementById('header-username');
    const avatarEl = document.getElementById('header-avatar');

    const fioParts = [
        currentProfile.surname,
        currentProfile.name,
        currentProfile.patronymic
    ].filter(Boolean);

    const fio = fioParts.length ? fioParts.join(' ') : null;

    if (fio) {
        usernameEl.textContent = fio;
        usernameEl.removeAttribute('data-i18n');
    } else {
        usernameEl.setAttribute('data-i18n', 'default-username');
    }

    avatarEl.innerHTML = '';
    if (currentProfile.avatarUrl) {
        const img = document.createElement('img');
        img.src = currentProfile.avatarUrl;
        img.alt = 'Аватар';
        avatarEl.appendChild(img);
    } else {
        avatarEl.style.background = 'linear-gradient(135deg, #6b7ae3, #a78bfa)';
        avatarEl.textContent = '';
    }

    applyTranslations();
    window.currentProfile = currentProfile;
}