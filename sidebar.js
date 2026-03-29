// sidebar.js — Управление левым сайдбаром

/**
 * Инициализация сайдбара
 * Отвечает за сворачивание/разворачивание левой панели и сохранение состояния
 */
export function initSidebar() {
    // Получаем основные элементы
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');

    // ====================== ВОССТАНОВЛЕНИЕ СОСТОЯНИЯ ======================
    // Проверяем, было ли сайдбар свёрнут при предыдущем посещении
    const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    
    // Если был свёрнут — добавляем класс collapsed
    if (collapsed) {
        sidebar.classList.add('collapsed');
        // Меняем иконку кнопки на "развернуть"
        toggleBtn.textContent = '▶';
    } else {
        // Иконка по умолчанию — "гамбургер"
        toggleBtn.textContent = '☰';
    }

    // ====================== ОБРАБОТЧИК КЛИКА ======================
    // При нажатии на кнопку сворачивания/разворачивания
    toggleBtn.addEventListener('click', () => {
        // Переключаем класс collapsed (сворачиваем или разворачиваем сайдбар)
        sidebar.classList.toggle('collapsed');

        // Определяем текущее состояние после переключения
        const isCollapsed = sidebar.classList.contains('collapsed');

        // Сохраняем состояние в localStorage, чтобы запомнить при перезагрузке
        localStorage.setItem('sidebarCollapsed', isCollapsed);

        // Меняем иконку кнопки в зависимости от состояния
        if (isCollapsed) {
            toggleBtn.textContent = '▶';   // стрелка вправо — значит свёрнут
        } else {
            toggleBtn.textContent = '☰';  // гамбургер — значит развёрнут
        }
    });
}