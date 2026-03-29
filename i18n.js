// i18n.js — Система локализации (перевод интерфейса)

/**
 * Глобальные переменные модуля
 */
let translations = {};     // Объект, содержащий все переводы из JSON-файла
let currentLang = 'ru';    // Текущий активный язык (по умолчанию русский)

/**
 * Инициализация системы локализации
 * - Загружает файл localization.json
 * - Определяет язык браузера
 * - Проверяет сохранённый язык в localStorage
 * - Применяет переводы на странице
 */
export async function initI18n() {
    // ====================== ЗАГРУЗКА ПЕРЕВОДОВ ======================
    try {
        const response = await fetch('localization.json');
        translations = await response.json();
    } catch (e) {
        console.error('Не удалось загрузить файл локализации (localization.json)');
    }

    // ====================== ОПРЕДЕЛЕНИЕ ЯЗЫКА ======================
    // Получаем язык браузера (например, "ru-RU" → "ru")
    const browserLang = navigator.language.split('-')[0];

    // Проверяем, поддерживается ли этот язык нашим приложением
    currentLang = ['ru', 'en', 'de', 'fr'].includes(browserLang) 
        ? browserLang 
        : 'ru'; // Если язык не поддерживается — ставим русский по умолчанию

    // Если пользователь ранее выбирал язык — используем его (приоритет выше)
    const savedLang = localStorage.getItem('lang');
    if (savedLang) {
        currentLang = savedLang;
    }

    // Устанавливаем атрибут lang у <html> для корректного отображения
    document.documentElement.lang = currentLang;

    // Применяем переводы ко всем элементам на странице
    applyTranslations();

    // Возвращаем текущий язык (удобно для main.js)
    return currentLang;
}

/**
 * Смена языка интерфейса
 * @param {string} lang - Код языка ('ru', 'en', 'de', 'fr')
 */
export function setLanguage(lang) {
    if (!['ru', 'en', 'de', 'fr'].includes(lang)) return;

    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;

    applyTranslations();

    // Перерисовываем динамический контент (сайдбар с контактами)
    if (typeof window.renderContacts === 'function') {
        window.renderContacts();   // сделаем renderContacts глобальной
    }
}

/**
 * Основная функция применения переводов
 * Поддерживает:
 * - data-i18n          → textContent
 * - data-i18n-placeholder → placeholder
 * - data-i18n в <option> внутри <select>
 */
export function applyTranslations() {
    // 1. Обычный текст (data-i18n)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[key] && translations[key][currentLang]) {
            el.textContent = translations[key][currentLang];
        }
    });

    // 2. Placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[key] && translations[key][currentLang]) {
            el.placeholder = translations[key][currentLang];
        }
    });

    // 3. Опции в <select>
    document.querySelectorAll('select').forEach(select => {
        Array.from(select.options).forEach(option => {
            if (option.dataset.i18n) {
                const key = option.dataset.i18n;
                if (translations[key] && translations[key][currentLang]) {
                    option.textContent = translations[key][currentLang];
                }
            }
        });
    });

    // 4. Дополнительно: переводим кнопки и элементы, которые могли быть созданы динамически
    // (на всякий случай)
    document.querySelectorAll('button[data-i18n], .search-btn[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[key] && translations[key][currentLang]) {
            el.textContent = translations[key][currentLang];
        }
    });
}

/**
 * Получение перевода по ключу (для динамического текста)
 * Используется в theme.js для "Светлая / Тёмная"
 * 
 * @param {string} key - Ключ перевода
 * @returns {string} Переведённый текст или ключ (если перевода нет)
 */
export function getTranslation(key) {
    // Сначала пытаемся взять перевод для текущего языка
    if (translations[key] && translations[key][currentLang]) {
        return translations[key][currentLang];
    }
    
    // Если нет — fallback на русский
    if (translations[key] && translations[key]['ru']) {
        return translations[key]['ru'];
    }
    
    // Если вообще ничего нет — возвращаем ключ (для отладки)
    return key;
}

/**
 * Возвращает текущий активный язык
 * @returns {string} Код текущего языка ('ru', 'en', 'de' или 'fr')
 */
export function getCurrentLang() {
    return currentLang;
}