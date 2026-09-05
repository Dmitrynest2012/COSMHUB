const SUPPORTED = ['ru', 'en', 'de', 'fr'];

let translations = {};
let currentLang = 'ru';
let swapTimer = 0;

export async function initI18n() {
    try {
        const response = await fetch('localization.json');
        translations = await response.json();
    } catch (e) {
        console.error('Не удалось загрузить localization.json', e);
    }

    const browserLang = (navigator.language || 'ru').split('-')[0];
    currentLang = SUPPORTED.includes(browserLang) ? browserLang : 'ru';

    const savedLang = localStorage.getItem('lang');
    if (savedLang && SUPPORTED.includes(savedLang)) currentLang = savedLang;

    document.documentElement.lang = currentLang;
    applyTranslations();
    return currentLang;
}

export function setLanguage(lang) {
    if (!SUPPORTED.includes(lang) || lang === currentLang) return;

    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;

    const root = document.documentElement;
    root.classList.add('i18n-swap');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
        applyTranslations();
        if (typeof window.renderContacts === 'function') window.renderContacts();
        root.classList.remove('i18n-swap');
    }, 160);
}

export function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const value = t(el.getAttribute('data-i18n'));
        if (value) el.textContent = value;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const value = t(el.getAttribute('data-i18n-placeholder'));
        if (value) el.placeholder = value;
    });
}

export function getTranslation(key) {
    return t(key) || (translations[key] && translations[key].ru) || key;
}

export function getCurrentLang() {
    return currentLang;
}

function t(key) {
    return translations[key] && translations[key][currentLang];
}
