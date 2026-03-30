// chat.js — Чат с индикатором "Печатает" + кнопкой "Поделиться моим Real ID"

import { sendMessage, ensureConnection, sendTypingStatus, connections } from './peer.js';
import { applyTranslations, getTranslation } from './i18n.js';

let currentChatPeerId = null;
let currentContact = null;
let messages = {};

// Таймер для статуса печати
let typingTimer = null;
const TYPING_TIMEOUT = 1500;

// ====================== Открытие чата ======================
export function openChat(realPeerId, contact) {
    currentChatPeerId = realPeerId;
    currentContact = { ...contact };

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

                <div class="chat-header-actions">
                    <button id="share-my-id-btn" class="share-id-btn" title="Поделиться моим Real ID">
                        📤
                    </button>
                    <div class="chat-status">
                        <span id="chat-status-dot" class="status-dot offline"></span>
                        <span id="chat-status-text" class="status-text" data-i18n="status-offline">Офлайн</span>
                    </div>
                    <button id="close-chat-btn" class="chat-close-btn">✕</button>
                </div>
            </div>

            <div id="chat-messages" class="chat-messages"></div>

            <!-- Индикатор печати -->
            <div id="typing-indicator" class="typing-indicator" style="display: none;">
                <span data-i18n="typing">Печатает</span>
                <span class="typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                </span>
            </div>

            <div class="chat-input-area">
                <textarea id="chat-input" class="chat-textarea" 
                    placeholder="" data-i18n-placeholder="chat-placeholder"></textarea>
                <button id="send-message-btn" class="send-btn" data-i18n="send-button">Отправить</button>
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
        text.textContent = getTranslation('status-online') || 'Онлайн';
        text.style.color = '#4ade80';
    } else {
        dot.className = 'status-dot offline';
        text.textContent = getTranslation('status-offline') || 'Офлайн';
        text.style.color = '#f87171';
    }
}

// ====================== Слушатели событий ======================
function setupChatListeners() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-message-btn');
    const closeBtn = document.getElementById('close-chat-btn');
    const shareBtn = document.getElementById('share-my-id-btn');

    // Отправка сообщения
    const send = async () => {
        const text = input.value.trim();
        if (!text || !currentChatPeerId) return;

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

        if (sendMessage(currentChatPeerId, text)) {
            addMessage(currentChatPeerId, text, true);
            input.value = '';
            stopTyping();
        } else {
            alert('Не удалось отправить сообщение — соединение потеряно.');
        }
    };

    sendBtn.addEventListener('click', send);
    input.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    });

    // Печать (typing)
    input.addEventListener('input', () => {
        if (currentChatPeerId) startTyping();
    });
    input.addEventListener('blur', stopTyping);

    // Кнопка "Поделиться моим Real ID"
    if (shareBtn) {
        shareBtn.addEventListener('click', shareMyRealId);
    }

    closeBtn.addEventListener('click', closeChat);
}

// ====================== Кнопка "Поделиться моим Real ID" ======================
async function shareMyRealId() {
    const myId = window.myRealPeerId;
    if (!myId) {
        alert('Ваш Real Peer ID ещё не получен. Подождите подключения.');
        return;
    }

    const textToCopy = `> ${myId}`;

    try {
        await navigator.clipboard.writeText(textToCopy);

        const btn = document.getElementById('share-my-id-btn');
        const originalText = btn.textContent;
        
        btn.textContent = '✓';
        btn.style.backgroundColor = '#4ade80';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
        }, 1800);

        alert(`Скопировано в буфер обмена:\n\n${textToCopy}\n\n` +
              `Отправьте это сообщение другу — он сможет быстро обновить ваш Real ID у себя.`);

        console.log('✅ Поделился своим Real ID:', textToCopy);

    } catch (err) {
        console.error('Ошибка копирования:', err);
        alert(`Не удалось скопировать.\n\nСкопируйте вручную:\n> ${myId}`);
    }
}

// ====================== Статус "Печатает" ======================
function startTyping() {
    if (typingTimer) clearTimeout(typingTimer);
    
    sendTypingStatus(currentChatPeerId, true);

    typingTimer = setTimeout(() => stopTyping(), TYPING_TIMEOUT);
}

function stopTyping() {
    if (typingTimer) {
        clearTimeout(typingTimer);
        typingTimer = null;
    }
    sendTypingStatus(currentChatPeerId, false);
}

function showTypingIndicator(show) {
    const indicator = document.getElementById('typing-indicator');
    if (!indicator) return;
    indicator.style.display = show ? 'flex' : 'none';
}

// ====================== Обновление Real ID друга ======================
async function updateFriendRealId(newRealId) {
    if (!currentContact) return;

    const oldRealId = currentChatPeerId;
    console.log(`🔄 Обновляем real Peer ID друга: ${oldRealId} → ${newRealId}`);

    currentContact.realPeerId = newRealId;
    currentChatPeerId = newRealId;

    const displayEl = document.getElementById('chat-peer-id-display');
    if (displayEl) {
        displayEl.innerHTML = `
            ${currentContact.nicePeerId ? currentContact.nicePeerId + '<br>' : ''}
            <small>Real: ${newRealId}</small>
        `;
    }

    updateContactInStorage(currentContact);

    // Закрываем старое соединение
    if (connections && connections.has(oldRealId)) {
        const oldConn = connections.get(oldRealId);
        if (oldConn) oldConn.close();
        connections.delete(oldRealId);
    }

    try {
        await ensureConnection(newRealId);
        updateChatStatus(true);

        alert(`✅ Real ID друга обновлён!\n\n` +
              `Теперь попросите друга обновить ваш Real ID.\n` +
              `Он может просто вставить в чат:\n> ${window.myRealPeerId}`);

    } catch (err) {
        updateChatStatus(false);
        alert(`Real ID обновлён, но подключение не установлено.\n\nУбедитесь, что друг онлайн и тоже обновил ваш ID.`);
    }
}

function updateContactInStorage(updatedContact) {
    let contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    
    const index = contacts.findIndex(c => 
        (c.realPeerId === updatedContact.realPeerId) || 
        (c.nicePeerId && c.nicePeerId === updatedContact.nicePeerId)
    );

    if (index !== -1) {
        contacts[index] = { ...contacts[index], ...updatedContact };
        localStorage.setItem('contacts', JSON.stringify(contacts));
    }
}

// ====================== Сообщения ======================
function renderMessages(peerId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = '';

    const msgList = messages[peerId] || [];
    msgList.forEach(msg => {
        const isMine = msg.from === window.myRealPeerId || msg.from === window.myPeerId;
        const time = new Date(msg.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit' 
        });

        const senderText = isMine 
            ? (getTranslation('you') || 'Вы') 
            : (getTranslation('interlocutor') || 'Собеседник');

        container.innerHTML += `
            <div class="message ${isMine ? 'message-mine' : 'message-their'}">
                ${!isMine ? `<div class="message-avatar"></div>` : ''}
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-sender">${senderText}</span>
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
    if (data.type === 'message') {
        addMessage(peerId, data.message.text || data.text, false);
    } else if (data.type === 'typing') {
        showTypingIndicator(data.isTyping);
    }
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