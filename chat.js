// chat.js — Чат с авто-реконнектом и индикатором онлайн

import { sendMessage, ensureConnection } from './peer.js';
import { applyTranslations, getTranslation } from './i18n.js';

let currentChatPeerId = null;
let messages = {};

export function openChat(peerId, contact) {
    currentChatPeerId = peerId;
    highlightActiveContact(peerId);

    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const html = `
        <div class="chat-window">
            <div class="chat-header">
                <div class="chat-contact-info">
                    <div class="chat-avatar" style="${contact.avatarUrl ? `background-image: url(${contact.avatarUrl}); background-size: cover;` : 'background: linear-gradient(135deg, #6b7ae3, #a78bfa);'}"></div>
                    <div>
                        <div class="chat-contact-name">${[contact.surname, contact.name, contact.patronymic].filter(Boolean).join(' ') || 'Пользователь'}</div>
                        <div class="chat-peer-id">${peerId}</div>
                    </div>
                </div>
                <div class="chat-status">
                    <span id="chat-status-dot" class="status-dot online"></span>
                    <span id="chat-status-text" class="status-text">Онлайн</span>
                </div>
                <button id="close-chat-btn" class="chat-close-btn">✕</button>
            </div>

            <div id="chat-messages" class="chat-messages"></div>

            <div class="chat-input-area">
                <textarea id="chat-input" class="chat-textarea" placeholder="Напишите сообщение..."></textarea>
                <button id="send-message-btn" class="send-btn">Отправить</button>
            </div>
        </div>
    `;

    mainContent.innerHTML = html;
    applyTranslations();

    // Авто-реконнект + загрузка истории
    initChatConnection(peerId);
    renderMessages(peerId);
    setupChatListeners();
}

async function initChatConnection(peerId) {
    try {
        await ensureConnection(peerId);           // ← авто-реконнект
        updateChatStatus(true);
    } catch (err) {
        updateChatStatus(false);
        console.warn('Не удалось подключиться к собеседнику');
    }
}

function updateChatStatus(isOnline) {
    const dot = document.getElementById('chat-status-dot');
    const text = document.getElementById('chat-status-text');
    if (!dot || !text) return;

    if (isOnline) {
        dot.className = 'status-dot online';
        text.textContent = 'Онлайн';
        text.style.color = '#4ade80';
    } else {
        dot.className = 'status-dot offline';
        text.textContent = 'Офлайн';
        text.style.color = '#f87171';
    }
}

function highlightActiveContact(peerId) {
    document.querySelectorAll('.contact-card').forEach(card => {
        card.classList.toggle('active-contact', card.dataset.peerId === peerId);
    });
}

function renderMessages(peerId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = '';

    const msgList = messages[peerId] || [];
    msgList.forEach(msg => {
        const isMine = msg.from === window.myPeerId;
        const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        container.innerHTML += `
            <div class="message ${isMine ? 'message-mine' : 'message-their'}">
                ${!isMine ? `<div class="message-avatar"></div>` : ''}
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-sender">${isMine ? 'Вы' : 'Собеседник'}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-text">${msg.text}</div>
                </div>
            </div>
        `;
    });

    container.scrollTop = container.scrollHeight;
}

export function addMessage(peerId, text, isMine = true) {
    if (!messages[peerId]) messages[peerId] = [];
    messages[peerId].push({ text, timestamp: Date.now(), from: isMine ? window.myPeerId : peerId });

    if (currentChatPeerId === peerId) renderMessages(peerId);
}

window.handleIncomingMessage = (peerId, data) => {
    addMessage(peerId, data.text, false);
};

function setupChatListeners() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-message-btn');
    const closeBtn = document.getElementById('close-chat-btn');

    const send = () => {
        const text = input.value.trim();
        if (!text || !currentChatPeerId) return;

        if (sendMessage(currentChatPeerId, text)) {
            addMessage(currentChatPeerId, text, true);
            input.value = '';
        } else {
            alert('Не удалось отправить — соединение потеряно');
        }
    };

    sendBtn?.addEventListener('click', send);
    input?.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    });

    closeBtn?.addEventListener('click', closeChat);
}

function closeChat() {
    currentChatPeerId = null;
    document.querySelectorAll('.contact-card').forEach(c => c.classList.remove('active-contact'));

    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="welcome-block">
            <h2 data-i18n="welcome" class="welcome-text">Добро пожаловать в мессенджер!</h2>
            <p class="placeholder-text">Выберите контакт для начала общения</p>
        </div>
    `;
    applyTranslations();
}