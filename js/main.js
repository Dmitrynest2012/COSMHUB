import { initI18n } from './i18n.js';
import { initTheme } from './theme.js';
import { initSidebar } from './sidebar.js';
import { initMenu } from './menu.js';
import { initProfile } from './profile.js';
import { initContacts } from './contacts.js';
import { initPeer } from './peer.js';

async function startApp() {
    await initI18n();
    await initPeer();
    initTheme();
    initSidebar();
    initMenu();
    initProfile();
    initContacts();
}

startApp();

document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'F8') {
        e.preventDefault();
        localStorage.clear();
        alert('Локальное хранилище очищено');
    }
});
