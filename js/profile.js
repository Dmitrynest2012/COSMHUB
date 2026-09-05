import { applyTranslations, getTranslation } from './i18n.js';

let currentProfile = {};

export function initProfile() {
    const avatarHeader = document.getElementById('header-avatar');
    const userBlock = document.getElementById('user-block');
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.getElementById('modal-close');
    const saveBtn = document.getElementById('save-profile-btn');

    const saved = localStorage.getItem('profile');
    if (saved) {
        try { currentProfile = JSON.parse(saved); } catch (e) { currentProfile = {}; }
        renderHeaderProfile();
    }
    window.currentProfile = currentProfile;

    avatarHeader.addEventListener('click', openProfileModal);
    userBlock.addEventListener('click', (e) => {
        if (e.target.id !== 'menu-toggle') openProfileModal();
    });

    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    const urlInput = document.getElementById('avatar-url-input');
    urlInput.addEventListener('input', () => setAvatarPreview(urlInput.value.trim()));

    saveBtn.addEventListener('click', saveProfile);
}

function setAvatarPreview(url) {
    const preview = document.getElementById('preview-avatar');
    if (!preview) return;
    if (url) {
        preview.style.backgroundImage = `url(${url})`;
        preview.style.backgroundSize = 'cover';
        preview.style.backgroundPosition = 'center';
    } else {
        preview.style.backgroundImage = '';
        preview.style.background = 'linear-gradient(135deg, var(--accent), var(--lavender))';
    }
}

function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    const peerIdInput = document.getElementById('profile-peer-id');
    const generateBtn = document.getElementById('generate-peer-id');

    document.getElementById('profile-name').value = currentProfile.name || '';
    document.getElementById('profile-surname').value = currentProfile.surname || '';
    document.getElementById('profile-patronymic').value = currentProfile.patronymic || '';
    document.getElementById('profile-gender').value = currentProfile.gender || 'male';
    document.getElementById('profile-birthdate').value = currentProfile.birthdate || '';

    const urlInput = document.getElementById('avatar-url-input');
    urlInput.value = currentProfile.avatarUrl || '';
    setAvatarPreview(currentProfile.avatarUrl || '');

    peerIdInput.value = window.myRealPeerId || getTranslation('loading');
    generateBtn.textContent = getTranslation('copy-real-id');
    generateBtn.onclick = copyRealPeerId;

    modal.style.display = 'flex';
    applyTranslations();
}

async function copyRealPeerId() {
    const realId = window.myRealPeerId;
    if (!realId) {
        alert(getTranslation('peer-init-error'));
        return;
    }

    try {
        await navigator.clipboard.writeText(realId);
        const btn = document.getElementById('generate-peer-id');
        const originalText = btn.textContent;
        btn.textContent = getTranslation('copy-real-id-success');
        btn.style.backgroundColor = '#4ade80';
        btn.style.color = '#111';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
            btn.style.color = '';
        }, 2000);
    } catch (err) {
        alert(realId);
    }
}

function saveProfile() {
    currentProfile = {
        ...currentProfile,
        name: document.getElementById('profile-name').value.trim(),
        surname: document.getElementById('profile-surname').value.trim(),
        patronymic: document.getElementById('profile-patronymic').value.trim(),
        gender: document.getElementById('profile-gender').value,
        birthdate: document.getElementById('profile-birthdate').value,
        avatarUrl: document.getElementById('avatar-url-input').value.trim()
    };

    localStorage.setItem('profile', JSON.stringify(currentProfile));
    window.currentProfile = currentProfile;
    renderHeaderProfile();
    document.getElementById('profile-modal').style.display = 'none';
}

function renderHeaderProfile() {
    const usernameEl = document.getElementById('header-username');
    const avatarEl = document.getElementById('header-avatar');

    const fio = [currentProfile.surname, currentProfile.name, currentProfile.patronymic]
        .filter(Boolean)
        .join(' ');

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
        img.alt = '';
        avatarEl.appendChild(img);
    } else {
        avatarEl.style.background = 'linear-gradient(135deg, var(--accent), var(--lavender))';
    }

    applyTranslations();
    window.currentProfile = currentProfile;
}
