// main.js — Основной файл приложения (точка входа)

/**
 * Импорт всех модулей приложения
 */
import { initI18n, setLanguage, getCurrentLang } from './i18n.js';
import { initTheme, updateThemeText } from './theme.js';
import { initSidebar } from './sidebar.js';
import { initContacts } from './contacts.js';
import { initProfile } from './profile.js';
import { initPeer } from './peer.js';
import { initChat } from './chat.js'; // если сделаешь init, или просто импортируй при необходимости


/**
 * Главная асинхронная функция запуска всего приложения
 * Выполняется сразу при загрузке страницы
 */
async function startApp() {
    // ====================== ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ ======================
    
    // 1. Локализация (должна быть первой, т.к. другие модули могут использовать переводы)
    await initI18n();

    // 2. Тема интерфейса (светлая/тёмная)
    initTheme();

    // 3. Сайдбар (сворачивание/разворачивание)
    initSidebar();

    // 4. Модуль профиля пользователя
    initProfile();

    await initPeer();

    // 5. Модуль работы с контактами
    initContacts();

    // ====================== РАБОТА С КОНТЕКСТНЫМ МЕНЮ ======================
    // Получаем элементы меню (стрелка и само выпадающее меню)
    const menuToggle = document.getElementById('menu-toggle');
    const contextMenu = document.getElementById('context-menu');
    
    // Флаг состояния меню (открыто/закрыто)
    let menuOpen = false;

    /**
     * Переключает видимость контекстного меню
     */
    function toggleMenu() {
        menuOpen = !menuOpen;
        
        // Показываем/скрываем меню
        contextMenu.style.display = menuOpen ? 'flex' : 'none';
        
        // Поворачиваем стрелку (▼ → ▲)
        menuToggle.style.transform = menuOpen ? 'rotate(180deg)' : 'rotate(0)';
    }

    // ====================== ОБРАБОТЧИКИ СОБЫТИЙ МЕНЮ ======================
    
    // Открытие меню по клику на стрелку
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();        // Предотвращаем всплытие события
        toggleMenu();
    });

    // Закрытие меню при клике в любом другом месте экрана
    document.addEventListener('click', (e) => {
        if (menuOpen && 
            !contextMenu.contains(e.target) && 
            e.target !== menuToggle) {
            toggleMenu();
        }
    });

    // ====================== ОБРАБОТКА ВЫБОРА ЯЗЫКА ======================
    const langSelect = document.getElementById('lang-select');
    
    // Устанавливаем текущее значение в селекте
    langSelect.value = getCurrentLang();

    // При смене языка обновляем переводы и текст темы
    langSelect.addEventListener('change', () => {
        setLanguage(langSelect.value);
        updateThemeText();   // Обновляем текст "Светлая / Тёмная" под новый язык
    });

    // ====================== ЗАПУСК ЗАВЕРШЁН ======================
    console.log(
        '%c✅ Мессенджер успешно запущен! Все модули инициализированы.',
        'color:#6b7ae3; font-size:15px; font-weight:600'
    );
}

// Запускаем приложение
startApp();




