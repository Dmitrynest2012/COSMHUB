// chat.js — Чат с поддержкой обновления real Peer ID друга через команду "> "

import { sendMessage, ensureConnection } from './peer.js';
import { applyTranslations, getTranslation } from './i18n.js';

let currentChatPeerId = null;   // текущий real Peer ID, с которым открыт чат
let currentContact = null;      // полный объект контакта
let messages = {};

// ====================== Открытие чата ======================
export function openChat(realPeerId, contact) {
    currentChatPeerId = realPeerId;
    currentContact = { ...contact }; // копируем объект

    highlightActiveContact(realPeerId);

    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const fullName = [contact.surname, contact.name, contact.patronymic]
        .filter(Boolean).join(' ') || 'Пользователь';

    const html = `
        <div class="chat-window">
            <div class="chat-header">
                <div class="chat-contact-info">
                    <div class="chat-avatar" style="${contact.avatarUrl 
                        ? `background-image: url(${contact.avatarUrl}); background-size: cover; background-position: center;` 
                        : 'background: linear-gradient(135deg, #6b7ae3, #a78bfa);'}"></div>
                    <div>
                        <div class="chat-contact-name">${fullName}</div>
                        <div class="chat-peer-id" id="chat-peer-id-display">
                            ${contact.nicePeerId ? contact.nicePeerId + '<br>' : ''}
                            <small>Real: ${realPeerId}</small>
                        </div>
                    </div>
                </div>
                <div class="chat-status">
                    <span id="chat-status-dot" class="status-dot offline"></span>
                    <span id="chat-status-text" class="status-text">Офлайн</span>
                </div>
                <button id="close-chat-btn" class="chat-close-btn">✕</button>
            </div>

            <div id="chat-messages" class="chat-messages"></div>

            <div class="chat-input-area">
                <textarea id="chat-input" class="chat-textarea" 
                    placeholder="Напишите сообщение...&#10;Или введите > новый_real_id для обновления"></textarea>
                <button id="send-message-btn" class="send-btn">Отправить</button>
            </div>
        </div>
    `;

    mainContent.innerHTML = html;
    applyTranslations();

    initChatConnection(realPeerId);
    renderMessages(realPeerId);
    setupChatListeners();
}

// ====================== Инициализация соединения ======================
async function initChatConnection(peerId) {
    try {
        await ensureConnection(peerId);
        updateChatStatus(true);
    } catch (err) {
        updateChatStatus(false);
        console.warn('Не удалось установить соединение с собеседником');
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

// ====================== Обработка отправки сообщений ======================
function setupChatListeners() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-message-btn');
    const closeBtn = document.getElementById('close-chat-btn');

    const send = async () => {
        const text = input.value.trim();
        if (!text || !currentChatPeerId || !currentContact) return;

        // === КОМАНДА ОБНОВЛЕНИЯ REAL ID ===
        if (text.startsWith('> ')) {
            const newRealId = text.substring(2).trim();
            
            if (newRealId.length < 10) {
                alert('Слишком короткий Peer ID');
                return;
            }

            await updateFriendRealId(newRealId);
            input.value = '';
            return;
        }

        // Обычное сообщение
        if (sendMessage(currentChatPeerId, text)) {
            addMessage(currentChatPeerId, text, true);
            input.value = '';
        } else {
            alert('Не удалось отправить сообщение — соединение потеряно. Попробуйте обновить ID друга.');
        }
    };

    sendBtn.addEventListener('click', send);
    input.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    });

    closeBtn.addEventListener('click', closeChat);
}

/**
 * Обновление real Peer ID друга
 */
async function updateFriendRealId(newRealId) {
    if (!currentContact) return;

    console.log(`🔄 Обновляем real Peer ID: ${currentChatPeerId} → ${newRealId}`);

    // Обновляем данные текущего чата
    currentContact.realPeerId = newRealId;
    currentChatPeerId = newRealId;

    // Обновляем отображение в шапке чата
    const displayEl = document.getElementById('chat-peer-id-display');
    if (displayEl) {
        displayEl.innerHTML = `
            ${currentContact.nicePeerId ? currentContact.nicePeerId + '<br>' : ''}
            <small>Real: ${newRealId}</small>
        `;
    }

    // Сохраняем изменения в localStorage (в списке контактов)
    updateContactInStorage(currentContact);

    // Пытаемся подключиться по новому ID
    try {
        await ensureConnection(newRealId);
        updateChatStatus(true);
        alert(`✅ Real ID успешно обновлён!\nТеперь можно общаться.`);
    } catch (err) {
        updateChatStatus(false);
        alert(`Real ID обновлён, но подключиться не удалось.\nПопросите друга тоже обновить страницу или отправить новый ID.`);
    }
}

// Обновление контакта в localStorage
function updateContactInStorage(updatedContact) {
    let contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    
    const index = contacts.findIndex(c => 
        (c.realPeerId === updatedContact.realPeerId) || 
        (c.nicePeerId && c.nicePeerId === updatedContact.nicePeerId)
    );

    if (index !== -1) {
        contacts[index] = { ...contacts[index], ...updatedContact };
        localStorage.setItem('contacts', JSON.stringify(contacts));
        console.log('✅ Контакт обновлён в хранилище');
    }
}

// ====================== Работа с сообщениями ======================
function renderMessages(peerId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = '';

    const msgList = messages[peerId] || [];
    msgList.forEach(msg => {
        const isMine = msg.from === window.myRealPeerId || msg.from === window.myPeerId;
        const time = new Date(msg.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

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
    
    messages[peerId].push({
        text,
        timestamp: Date.now(),
        from: isMine ? (window.myRealPeerId || window.myPeerId) : peerId
    });

    if (currentChatPeerId === peerId) {
        renderMessages(peerId);
    }
}

window.handleIncomingMessage = (peerId, data) => {
    addMessage(peerId, data.text, false);
};

function highlightActiveContact(peerId) {
    document.querySelectorAll('.contact-card').forEach(card => {
        card.classList.toggle('active-contact', card.dataset.realId === peerId);
    });
}

function closeChat() {
    currentChatPeerId = null;
    currentContact = null;

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