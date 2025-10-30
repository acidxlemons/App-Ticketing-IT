// src/router.js
import { AuthService } from './auth.js';
import { PermissionsService } from './permissions.js';

// Páginas
import { EmpleadoPage } from './pages/empleado/index.js';
import { TecnicoPage } from './pages/tecnico/index.js';
import { SupervisorPage } from './pages/supervisor/index.js';

export const Router = {
  currentPage: null,
  _initialized: false, // evita dobles inits

  init() {
    if (this._initialized) return;
    this._initialized = true;

    const user = AuthService.getCurrentUser();
    if (!user) { window.location.reload(); return; }

    this.render();
    this.setupEventListeners();
  },

  render() {
    const user = AuthService.getCurrentUser();
    const app = document.getElementById('content');

    // Limpia cualquier header/nav antiguos que hayan quedado fuera del #content
    document.querySelectorAll('.app-header, .app-nav').forEach(el => el.remove());

    app.innerHTML = `
      ${this.renderHeader(user)}
      ${this.renderNav(user)}
      <main class="main-container" id="page-content"></main>
    `;

    this.navigate(this.getDefaultRoute(user.rol));
  },

  renderHeader(user) {
    const isotipoSrc = './assets/E-sin-fondo.png';
    return `
      <header class="app-header">
        <div class="header-container">
          <div class="header-brand">
            <img src="${isotipoSrc}" alt="Europavia" class="brand-logo" style="height:40px; margin-right:10px;" />
            <span class="brand-title" style="font-size:1.5rem; font-weight:bold; color:#2563eb; text-transform:uppercase;">
              SISTEMA DE TICKETS IT
            </span>
          </div>
          <div class="header-user">
            <div class="user-info">
              <div class="user-name">${user.nombre}</div>
              <div class="user-role">${user.rol}</div>
            </div>
            <button class="btn-logout" id="btn-logout" aria-label="Cerrar sesión">Salir</button>
          </div>
        </div>
      </header>
    `;
  },

  renderNav(user) {
    const routes = this.getRoutesForRole(user.rol);
    return `
      <nav class="app-nav" aria-label="Navegación principal">
        <div class="nav-container">
          <ul class="nav-tabs" role="tablist">
            ${routes.map(route => `
              <li role="presentation">
                <a href="#${route.path}"
                   class="nav-link"
                   role="tab"
                   data-route="${route.path}">
                  ${route.label}
                </a>
              </li>`).join('')}
          </ul>
        </div>
      </nav>
    `;
  },

  getRoutesForRole(role) {
    const routes = {
      Empleado: [
        { path: 'mis-tickets', label: 'Mis Tickets' },
        { path: 'crear-ticket', label: 'Crear Ticket' }
      ],
      Tecnico: [
        { path: 'asignados', label: 'Asignados a mí' },
        { path: 'todos', label: 'Todos' },
        { path: 'en-espera', label: 'En espera' },
        { path: 'escalados', label: 'Escalados' }
      ],
      Supervisor: [
        { path: 'dashboard', label: 'Dashboard' },
        { path: 'tickets', label: 'Tickets' },
        { path: 'usuarios', label: 'Usuarios' }
      ]
    };
    return routes[role] || [];
  },

  getDefaultRoute(role) {
    const defaults = {
      Empleado: 'mis-tickets',
      Tecnico: 'asignados',
      Supervisor: 'dashboard'
    };
    return defaults[role] || 'mis-tickets';
  },

  navigate(route) {
    const user = AuthService.getCurrentUser();
    const pageContent = document.getElementById('page-content');

    // Activar pestaña
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.route === route);
    });

    try {
      switch (user.rol) {
        case 'Empleado':
          EmpleadoPage.render(route, pageContent);
          break;
        case 'Tecnico':
          TecnicoPage.render(route, pageContent);
          break;
        case 'Supervisor':
          SupervisorPage.render(route, pageContent);
          break;
        default:
          pageContent.innerHTML = '<div class="access-denied">Rol no reconocido</div>';
      }
    } catch (error) {
      console.error('Error al navegar:', error);
      pageContent.innerHTML = `
        <div class="access-denied">
          <div class="access-denied-icon">⚠️</div>
          <h2 class="access-denegado-title">Error</h2>
          <p class="access-denied-message">${error.message}</p>
        </div>
      `;
    }
  },

  setupEventListeners() {
    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        AuthService.logout();
      }
    });

    // Navegación por tabs
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = e.currentTarget.dataset.route;
        this.navigate(route);
      });
    });
  }
};
