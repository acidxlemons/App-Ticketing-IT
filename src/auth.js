// src/auth.js
import { UsersService } from './services/users.js';
import { DB } from './store/db.js';

const LS_KEY = 'currentUser_persist';
const SS_KEY = 'currentUser_session';

function persistUser(user, remember) {
  try {
    const json = JSON.stringify(user);
    if (remember) {
      localStorage.setItem(LS_KEY, json);
      sessionStorage.removeItem(SS_KEY);
    } else {
      sessionStorage.setItem(SS_KEY, json);
      localStorage.removeItem(LS_KEY);
    }
  } catch (_) { /* noop */ }
}

function readPersistedUser() {
  try {
    const ls = localStorage.getItem(LS_KEY);
    if (ls) return JSON.parse(ls);
    const ss = sessionStorage.getItem(SS_KEY);
    if (ss) return JSON.parse(ss);
  } catch (_) { /* noop */ }
  return null;
}

function clearPersistedUser() {
  try {
    localStorage.removeItem(LS_KEY);
    sessionStorage.removeItem(SS_KEY);
  } catch (_) { /* noop */ }
}

export const AuthService = {
  /**
   * Devuelve el usuario actual desde memoria persistida (local/sessionStorage)
   */
  getCurrentUser() {
    return readPersistedUser();
  },

  /**
   * Auto-login si hay sesión persistida
   */
  tryAutoLogin() {
    return readPersistedUser();
  },

  /**
   * LOGIN COMO EMPLEADO (siempre fuerza rol 'Empleado')
   * Aunque el email exista como técnico/supervisor, aquí SIEMPRE será Empleado.
   */
  loginAsEmployee({ nombre, apellidos, email }, { rememberSession = false } = {}) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Email requerido');

    // Construimos un usuario "empleado" SIEMPRE
    const user = {
      id: `emp-${cleanEmail}`,           // ID estable por email (útil para ver históricos)
      nombre: `${nombre || ''} ${apellidos || ''}`.trim(),
      email: cleanEmail,
      rol: 'Empleado',
      // Puedes guardar metadatos de origen si quieres
      _loginMode: 'employee-form'
    };

    persistUser(user, rememberSession);
    return user;
  },

  /**
   * LOGIN CON CREDENCIALES (Técnico / Supervisor)
   * Valida contra UsersService (o tu DB) y respeta el rol almacenado ahí.
   */
  loginWithCredentials(email, password, { rememberSession = false } = {}) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !password) throw new Error('Credenciales requeridas');

    // Aquí sí miramos la base de usuarios corporativos
    const user = UsersService.getByEmail(cleanEmail);
    if (!user) throw new Error('Usuario no encontrado');
    if (!UsersService.verifyPassword(user.id, password)) {
      throw new Error('Contraseña incorrecta');
    }

    // Guardamos solo los campos que necesitas en sesión
    const sessionUser = {
      id: user.id,
      nombre: user.nombre || user.email,
      email: user.email,
      rol: user.rol, // 'Tecnico' o 'Supervisor'
      _loginMode: 'tech-credentials'
    };

    persistUser(sessionUser, rememberSession);
    return sessionUser;
  },

  /**
   * Cierra sesión
   */
  logout() {
    clearPersistedUser();
    // Opcionalmente limpia otras cosas de demo
    // DB u otros estados no se tocan
    window.location.reload();
  }
};
