// src/app.js
import { AuthService } from './auth.js';
import { Router } from './router.js';
import { initDB } from './store/db.js';

// ---------- helpers ----------
function setHeaderVisible(show) {
  const header = document.querySelector('.app-header');
  if (header) header.style.display = show ? '' : 'none';
}

// 1) Inicializar base de datos
initDB();

// 2) Auto-login si existe
let autoUser = null;
try {
  if (typeof AuthService.tryAutoLogin === 'function') {
    autoUser = AuthService.tryAutoLogin();
  }
} catch { /* noop */ }

// 3) ¿Sesión activa?
const currentUser = autoUser || AuthService.getCurrentUser();

if (!currentUser) {
  showLogin();            // ⇠ login sin header
} else {
  setHeaderVisible(true); // ⇠ mostrar header ya logueado
  Router.init();
}

function showLogin() {
  setHeaderVisible(false); // ⇠ oculta isotipo del header en la pantalla de login

  const app = document.getElementById('content');

  // Prefills guardados previamente
  const rememberEmp = JSON.parse(localStorage.getItem('rememberEmployeeFields') || 'null');
  const rememberTech = JSON.parse(localStorage.getItem('rememberTechLogin') || 'null');

  // Captcha sencillo
  const a = Math.floor(1 + Math.random() * 9);
  const b = Math.floor(1 + Math.random() * 9);

  app.innerHTML = `
    <div class="login-container">
      <div class="card login-card">
        <div class="card-body">

          <!-- Logo corporativo GRANDE (no isotipo) -->
          <img src="./assets/logosinfondo.png" alt="EUROPAVIA" class="login-logo" />

          <h1 class="login-title" style="text-align:center;margin-bottom:.25rem;">
            Sistema de Tickets
          </h1>
          <p style="text-align:center;margin-bottom:2rem;color:var(--text-secondary);">
            Identifícate para continuar
          </p>

          <!-- Empleado -->
          <h2 class="card-title" style="margin-bottom:.75rem;">Entrar como Empleado</h2>
          <form id="form-identidad" class="user-select-grid" style="margin-bottom:2rem;" novalidate>
            <div class="form-group">
              <label class="form-label required" for="emp-nombre">Nombre</label>
              <input id="emp-nombre" class="form-input" required value="${rememberEmp?.nombre || ''}"/>
            </div>
            <div class="form-group">
              <label class="form-label required" for="emp-apellidos">Apellidos</label>
              <input id="emp-apellidos" class="form-input" required value="${rememberEmp?.apellidos || ''}"/>
            </div>
            <div class="form-group">
              <label class="form-label required" for="emp-email">Correo</label>
              <input id="emp-email" class="form-input" type="email" required value="${rememberEmp?.email || ''}"/>
              <small class="form-help">Usaremos este correo para avisos y para mostrarte sólo tus tickets.</small>
            </div>
            <div class="form-group">
              <label class="form-label required">Captcha</label>
              <div class="form-inline">
                <span aria-hidden="true" style="padding:.5rem 0;">¿Cuánto es <strong>${a}</strong> + <strong>${b}</strong>?</span>
                <input id="emp-captcha" class="form-input" type="number" placeholder="Resultado" required style="max-width:160px"/>
              </div>
              <small class="form-help">Verificación anti-bot simple</small>
            </div>
            <div class="form-group">
              <label class="form-label required">
                <input type="checkbox" id="emp-acepto" style="margin-right:.5rem" ${rememberEmp?.acepto ? 'checked' : ''}/>
                Acepto la política de protección de datos
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" id="emp-remember-fields" style="margin-right:.5rem" ${rememberEmp ? 'checked' : ''}/>
                Recordar mis datos en este equipo
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" id="emp-remember-session" style="margin-right:.5rem"/>
                Mantener sesión iniciada
              </label>
            </div>
            <div class="btn-group">
              <button class="btn btn-primary" type="submit">Continuar</button>
            </div>
          </form>

          <!-- Técnico / Supervisor -->
          <h2 class="card-title" style="margin-bottom:.75rem;">Entrar como Técnico / Supervisor</h2>
          <form id="form-login" class="user-select-grid" novalidate>
            <div class="form-group">
              <label class="form-label required" for="login-email">Email</label>
              <input id="login-email" class="form-input" type="email" required value="${rememberTech?.email || ''}"/>
              <small class="form-help">
                Técnicos válidos: icabanas@europavia.es, amballesteros@europavia.es — Supervisor: gfernandez@europavia.es
              </small>
            </div>
            <div class="form-group">
              <label class="form-label required" for="login-pass">Contraseña</label>
              <input id="login-pass" class="form-input" type="password" required value="${rememberTech?.rememberPassword ? (rememberTech?.password || '') : ''}"/>
              <div class="form-help">
                <label>
                  <input type="checkbox" id="tech-remember-pass" ${rememberTech?.rememberPassword ? 'checked' : ''}/>
                  Recordar contraseña (solo demo)
                </label>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" id="tech-remember-login" ${rememberTech ? 'checked' : ''}/>
                Recordar mi email en este equipo
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" id="tech-remember-session"/>
                Mantener sesión iniciada
              </label>
            </div>
            <div class="btn-group">
              <button class="btn btn-secondary" type="submit">Entrar</button>
            </div>
          </form>

        </div>
      </div>
    </div>
  `;

  // --- Empleado ---
  document.getElementById('form-identidad').addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('emp-nombre').value.trim();
    const apellidos = document.getElementById('emp-apellidos').value.trim();
    const email = document.getElementById('emp-email').value.trim();
    const captcha = parseInt(document.getElementById('emp-captcha').value, 10);
    const acepto = document.getElementById('emp-acepto').checked;
    const rememberFields = document.getElementById('emp-remember-fields').checked;
    const rememberSession = document.getElementById('emp-remember-session').checked;

    if (!nombre || !apellidos || !validateEmail(email)) { alert('Rellena nombre, apellidos y un email válido.'); return; }
    if (captcha !== (a + b)) { alert('Captcha incorrecto.'); return; }
    if (!acepto) { alert('Debes aceptar la política de protección de datos.'); return; }

    if (rememberFields) {
      localStorage.setItem('rememberEmployeeFields', JSON.stringify({ nombre, apellidos, email, acepto: true }));
    } else {
      localStorage.removeItem('rememberEmployeeFields');
    }

    try {
      AuthService.loginAsEmployee({ nombre, apellidos, email }, { rememberSession });
      setHeaderVisible(true);   // ⇠ mostrar header una vez logueado
      Router.init();
    } catch (err) {
      alert(err.message || 'No se pudo iniciar sesión');
    }
  });

  // --- Técnico / Supervisor ---
  document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;
    const rememberLogin = document.getElementById('tech-remember-login').checked;
    const rememberPassword = document.getElementById('tech-remember-pass').checked;
    const rememberSession = document.getElementById('tech-remember-session').checked;

    if (rememberLogin || rememberPassword) {
      localStorage.setItem('rememberTechLogin', JSON.stringify({
        email,
        password: rememberPassword ? pass : undefined,
        rememberPassword
      }));
    } else {
      localStorage.removeItem('rememberTechLogin');
    }

    try {
      AuthService.loginWithCredentials(email, pass, { rememberSession });
      setHeaderVisible(true);   // ⇠ mostrar header una vez logueado
      Router.init();
    } catch (err) {
      alert(err.message || 'Credenciales inválidas');
    }
  });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
