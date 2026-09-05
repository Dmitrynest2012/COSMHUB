export function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (!sidebar || !toggleBtn) return;

    const apply = (collapsed) => {
        sidebar.classList.toggle('collapsed', collapsed);
        toggleBtn.textContent = collapsed ? '▶' : '☰';
        toggleBtn.setAttribute('aria-expanded', String(!collapsed));
        localStorage.setItem('sidebarCollapsed', String(collapsed));
    };

    apply(localStorage.getItem('sidebarCollapsed') === 'true');

    toggleBtn.addEventListener('click', () => {
        apply(!sidebar.classList.contains('collapsed'));
    });
}
