// theme.js — Управление темами (с комментариями)

/**
 * Импорт функции для получения переводов из файла локализации
 */
import { getTranslation } from './i18n.js';

// Глобальная переменная для хранения текущего состояния темы
let isDark = false;

/**
 * Инициализация темы при запуске приложения
 * - Загружает сохранённую тему из localStorage
 * - Учитывает системную настройку (prefers-color-scheme)
 * - Устанавливает чекбокс и применяет класс .dark
 */
export function initTheme() {
    // Получаем сохранённую тему из локального хранилища
    const savedTheme = localStorage.getItem('theme');

    // Если тема была сохранена как тёмная ИЛИ
    // тема не сохранена, но у пользователя включена тёмная тема в системе
    if (savedTheme === 'dark' || 
        (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        
        isDark = true;
        document.documentElement.classList.add('dark');   // Применяем тёмную тему
        document.getElementById('theme-toggle').checked = true; // Ставим чекбокс
    }

    // Обновляем текст "Светлая / Тёмная" при инициализации
    updateThemeText();

    // Находим переключатель темы
    const toggle = document.getElementById('theme-toggle');

    // Добавляем обработчик изменения чекбокса
    toggle.addEventListener('change', () => {
        // Обновляем состояние переменной
        isDark = toggle.checked;

        if (isDark) {
            // Включаем тёмную тему
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            // Выключаем тёмную тему (возвращаем светлую)
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }

        // Обновляем текст рядом с переключателем ("Светлая" / "Тёмная")
        updateThemeText();

        // Плавная анимация смены темы
        document.body.classList.add('theme-changing');
        setTimeout(() => {
            document.body.classList.remove('theme-changing');
        }, 600);
    });
}

/**
 * Обновляет текст переключателя темы ("Светлая" или "Тёмная")
 * в зависимости от текущей темы и выбранного языка
 */
function updateThemeText() {
    const textEl = document.getElementById('theme-text');
    
    if (textEl) {
        // Выбираем ключ перевода в зависимости от текущей темы
        const key = isDark ? 'dark-theme-option' : 'light-theme-option';
        
        // Получаем переведённый текст и вставляем его
        textEl.textContent = getTranslation(key);
    }
}

// Экспортируем функцию updateThemeText, чтобы её можно было вызвать
// из main.js при смене языка
export { updateThemeText };