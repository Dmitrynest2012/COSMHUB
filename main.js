// main.js — Основной файл приложения (точка входа)

// main.js — Основной файл приложения

import { initI18n, setLanguage, getCurrentLang } from './i18n.js';
import { initTheme, updateThemeText } from './theme.js';
import { initSidebar } from './sidebar.js';
import { initProfile } from './profile.js';
import { initContacts } from './contacts.js';
import { initPeer } from './peer.js';        // ← важно

async function startApp() {
    // 1. Локализация
    await initI18n();

    // 2. PeerJS (должен быть до всего, что использует соединения)
    await initPeer();

    // 3. Тема
    initTheme();

    // 4. Сайдбар
    initSidebar();

    // 5. Профиль
    initProfile();

    // 6. Контакты (внутри будет динамический импорт chat.js)
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




document.addEventListener('keydown', (e) => {
    // Проверяем комбинацию Shift + F8
    if (e.shiftKey && e.key === 'F8') {
        e.preventDefault(); // на всякий случай

        // Очистка localStorage
        localStorage.clear();

        console.log('LocalStorage очищен 🚀');

        // опционально — уведомление пользователю
        alert('Локальное хранилище очищено');
    }
});