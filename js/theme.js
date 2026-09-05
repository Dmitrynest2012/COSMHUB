import { getTranslation } from './i18n.js';

let isDark = false;

export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    isDark = savedTheme ? savedTheme === 'dark' : prefersDark;

    applyTheme(isDark, false);
    updateThemeText();

    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    toggle.checked = isDark;
    toggle.addEventListener('change', () => {
        isDark = toggle.checked;
        applyTheme(isDark, true);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeText();
    });
}

function applyTheme(dark, animate) {
    const root = document.documentElement;
    if (animate) root.classList.add('theme-animating');
    root.classList.toggle('dark', dark);
    if (animate) {
        setTimeout(() => root.classList.remove('theme-animating'), 420);
    }
}

export function updateThemeText() {
    const textEl = document.getElementById('theme-text');
    if (!textEl) return;
    textEl.textContent = getTranslation(isDark ? 'dark-theme-option' : 'light-theme-option');
}

export function getIsDark() {
    return isDark;
}
