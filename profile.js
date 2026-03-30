// profile.js — Редактирование профиля + копирование Real Peer ID

import { applyTranslations, getTranslation } from './i18n.js';

/**
 * Глобальная переменная для хранения данных профиля
 */
let currentProfile = {};

/**
 * Основная инициализация профиля
 */
export function initProfile() {
    const avatarHeader = document.getElementById('header-avatar');
    const userBlock = document.getElementById('user-block');
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.getElementById('modal-close');
    const saveBtn = document.getElementById('save-profile-btn');

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
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Предпросмотр аватара
    const urlInput = document.getElementById('avatar-url-input');
    urlInput.addEventListener('input', () => {
        const url = urlInput.value.trim();
        const preview = document.getElementById('preview-avatar');
        if (url) {
            preview.style.backgroundImage = `url(${url})`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
        } else {
            preview.style.backgroundImage = '';
            preview.style.background = 'linear-gradient(135deg, #6b7ae3, #a78bfa)';
        }
    });

    // Сохранение профиля
    saveBtn.addEventListener('click', saveProfile);

    console.log('%c✅ profile.js инициализирован', 'color:#10b981; font-weight:700');
}

/**
 * Открывает модальное окно профиля
 */
function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    const peerIdInput = document.getElementById('profile-peer-id');
    const generateBtn = document.getElementById('generate-peer-id');

    // Заполняем данные профиля
    document.getElementById('profile-name').value = currentProfile.name || '';
    document.getElementById('profile-surname').value = currentProfile.surname || '';
    document.getElementById('profile-patronymic').value = currentProfile.patronymic || '';
    document.getElementById('profile-gender').value = currentProfile.gender || 'male';
    document.getElementById('profile-birthdate').value = currentProfile.birthdate || '';

    // URL аватара
    const urlInput = document.getElementById('avatar-url-input');
    urlInput.value = currentProfile.avatarUrl || '';

    // Превью аватарки
    const previewEl = document.getElementById('preview-avatar');
    if (currentProfile.avatarUrl) {
        previewEl.style.backgroundImage = `url(${currentProfile.avatarUrl})`;
        previewEl.style.backgroundSize = 'cover';
        previewEl.style.backgroundPosition = 'center';
    } else {
        previewEl.style.backgroundImage = '';
        previewEl.style.background = 'linear-gradient(135deg, #6b7ae3, #a78bfa)';
    }

    // === ПОКАЗЫВАЕМ ТЕКУЩИЙ REAL PEER ID ===
    if (window.myRealPeerId) {
        peerIdInput.value = window.myRealPeerId;
        peerIdInput.title = "Текущий Real Peer ID — отправьте его другу для добавления в контакты";
    } else {
        peerIdInput.value = "Ожидание подключения...";
        peerIdInput.title = "";
    }

    // Настраиваем кнопку — теперь она копирует Real ID
    generateBtn.textContent = getTranslation('copy-real-id') || 'Копировать ID';
    generateBtn.onclick = copyRealPeerId;        // динамически назначаем функцию копирования

    modal.style.display = 'flex';
    applyTranslations();
}

/**
 * Копирует текущий Real Peer ID в буфер обмена
 */
async function copyRealPeerId() {
    const realId = window.myRealPeerId;

    if (!realId) {
        alert('Real Peer ID ещё не получен.\nПодождите, пока установится соединение с сервером.');
        return;
    }

    try {
        await navigator.clipboard.writeText(realId);

        // Визуальная обратная связь
        const btn = document.getElementById('generate-peer-id');
        const originalText = btn.textContent;
        
        btn.textContent = '✓ Скопировано!';
        btn.style.backgroundColor = '#4ade80';
        btn.style.color = '#111';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
            btn.style.color = '';
        }, 2000);

        console.log('✅ Real Peer ID скопирован в буфер обмена:', realId);

    } catch (err) {
        console.error('Ошибка копирования в буфер:', err);
        alert('Не удалось скопировать ID.\nПопробуйте выделить текст вручную (Ctrl+C).');
    }
}

/**
 * Сохраняет профиль (без Nice ID в этом поле)
 */
function saveProfile() {
    currentProfile = {
        name: document.getElementById('profile-name').value.trim(),
        surname: document.getElementById('profile-surname').value.trim(),
        patronymic: document.getElementById('profile-patronymic').value.trim(),
        gender: document.getElementById('profile-gender').value,
        birthdate: document.getElementById('profile-birthdate').value,
        avatarUrl: document.getElementById('avatar-url-input').value.trim(),
        // nicePeerId здесь не сохраняем через это поле — он управляется в peer.js
    };

    localStorage.setItem('profile', JSON.stringify(currentProfile));
    window.currentProfile = currentProfile;

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

    // Аватар в шапке
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