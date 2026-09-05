import { setLanguage, getCurrentLang } from './i18n.js';
import { updateThemeText } from './theme.js';

export function initMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const contextMenu = document.getElementById('context-menu');
    const langSelect = document.getElementById('lang-select');
    if (!menuToggle || !contextMenu) return;

    const setOpen = (open) => {
        contextMenu.classList.toggle('is-open', open);
        menuToggle.classList.toggle('is-open', open);
        menuToggle.setAttribute('aria-expanded', String(open));
    };

    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(!contextMenu.classList.contains('is-open'));
    });

    document.addEventListener('click', (e) => {
        if (!contextMenu.classList.contains('is-open')) return;
        if (contextMenu.contains(e.target) || e.target === menuToggle) return;
        setOpen(false);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setOpen(false);
    });

    if (langSelect) {
        langSelect.value = getCurrentLang();
        langSelect.addEventListener('change', () => {
            setLanguage(langSelect.value);
            setTimeout(updateThemeText, 180);
        });
    }
}
