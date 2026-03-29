// chat.js — Управление окном чата

import { sendMessage } from './peer.js';
import { applyTranslations, getTranslation } from './i18n.js';

let currentChatPeerId = null;
let messages = {}; // peerId → массив сообщений

/**
 * Открыть чат с пользователем
 */
export function openChat(peerId, contact) {
    currentChatPeerId = peerId;

    // Подсвечиваем активный контакт в сайдбаре
    highlightActiveContact(peerId);

    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    let html = `
        <div class="chat-window">
            <!-- Заголовок чата -->
            <div class="chat-header">
                <div class="chat-contact-info">
                    <div class="chat-avatar" style="${contact.avatarUrl ? `background-image: url(${contact.avatarUrl}); background-size: cover;` : 'background: linear-gradient(135deg, #6b7ae3, #a78bfa);'}"></div>
                    <div>
                        <div class="chat-contact-name">${[contact.surname, contact.name, contact.patronymic].filter(Boolean).join(' ') || 'Пользователь'}</div>
                        <div class="chat-peer-id">${peerId}</div>
                    </div>
                </div>
                <button id="close-chat-btn" class="chat-close-btn">✕</button>
            </div>

            <!-- Область сообщений -->
            <div id="chat-messages" class="chat-messages"></div>

            <!-- Поле ввода -->
            <div class="chat-input-area">
                <textarea id="chat-input" class="chat-textarea" placeholder="Напишите сообщение..."></textarea>
                <button id="send-message-btn" class="send-btn">Отправить</button>
            </div>
        </div>
    `;

    mainContent.innerHTML = html;
    applyTranslations();

    renderMessages(peerId);
    setupChatListeners();
}

/**
 * Подсветка активного контакта
 */
function highlightActiveContact(peerId) {
    document.querySelectorAll('.contact-card').forEach(card => {
        card.classList.toggle('active-contact', card.dataset.peerId === peerId);
    });
}

/**
 * Рендер сообщений
 */
function renderMessages(peerId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = '';

    const msgList = messages[peerId] || [];

    msgList.forEach(msg => {
        const isMine = msg.from === window.myPeerId;
        const time = new Date(msg.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const html = `
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
        container.innerHTML += html;
    });

    container.scrollTop = container.scrollHeight;
}

/**
 * Добавление нового сообщения (используется и для своих, и для входящих)
 */
export function addMessage(peerId, text, isMine = true) {
    if (!messages[peerId]) messages[peerId] = [];

    messages[peerId].push({
        text: text,
        timestamp: Date.now(),
        from: isMine ? window.myPeerId : peerId
    });

    // Если чат сейчас открыт — сразу обновляем
    if (currentChatPeerId === peerId) {
        renderMessages(peerId);
    }
}

/**
 * Глобальная функция для обработки входящих сообщений из peer.js
 */
window.handleIncomingMessage = (peerId, data) => {
    addMessage(peerId, data.text, false);
};

/**
 * Настройка слушателей чата
 */
function setupChatListeners() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-message-btn');
    const closeBtn = document.getElementById('close-chat-btn');

    const send = () => {
        const text = input.value.trim();
        if (!text || !currentChatPeerId) return;

        const success = sendMessage(currentChatPeerId, text);
        if (success) {
            addMessage(currentChatPeerId, text, true);
            input.value = '';
        } else {
            alert('Не удалось отправить сообщение. Соединение потеряно.');
        }
    };

    if (sendBtn) sendBtn.addEventListener('click', send);
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeChat);
    }
}

/**
 * Закрытие чата
 */
function closeChat() {
    currentChatPeerId = null;
    document.querySelectorAll('.contact-card').forEach(card => {
        card.classList.remove('active-contact');
    });

    // Возвращаем приветственный экран
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="welcome-block">
                <h2 data-i18n="welcome" class="welcome-text">Добро пожаловать в мессенджер!</h2>
                <p class="placeholder-text">Выберите контакт для начала общения</p>
            </div>
        `;
        applyTranslations();
    }
}