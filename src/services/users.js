// src/services/users.js
import { DB } from '../store/db.js';

function stableEmployeeId(email) {
  return 'emp-' + String(email || '').trim().toLowerCase();
}
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
function slugFromEmail(email) {
  const local = String(email).split('@')[0] || 'user';
  return local.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

export const UsersService = {
  getAll() { return DB.getAll('usuarios'); },
  getById(id) { return DB.getById('usuarios', id); },

  getByEmail(email) {
    const e = normalizeEmail(email);
    return DB.query('usuarios', u => normalizeEmail(u.email) === e)[0] || null;
  },

  getByRole(rol) {
    return DB.query('usuarios', u => u.rol === rol);
  },

  getTecnicos() {
    return this.getByRole('Tecnico');
  },

  /**
   * Crea (o devuelve) un empleado con ID estable derivado del email.
   * Si ya existe y no tenía nombre, lo actualiza.
   */
  upsertEmployee(email, nombre = '') {
    const id = stableEmployeeId(email);
    const existing = this.getById(id) || this.getByEmail(email);
    if (existing) {
      if (!existing.nombre && nombre) {
        return DB.update('usuarios', existing.id, { nombre });
      }
      return existing;
    }
    const nuevo = {
      id,
      nombre: nombre || String(email).split('@')[0],
      email: String(email).trim(),
      rol: 'Empleado'
    };
    DB.insert('usuarios', nuevo);
    return nuevo;
  },

  /** Valida robustez de contraseña (mín. 8, mayúscula, minúscula, dígito, símbolo) */
  validatePassword(pass) {
    const errors = [];
    if (!pass || pass.length < 8) errors.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(pass)) errors.push('Al menos una mayúscula');
    if (!/[a-z]/.test(pass)) errors.push('Al menos una minúscula');
    if (!/[0-9]/.test(pass)) errors.push('Al menos un número');
    if (!/[^A-Za-z0-9]/.test(pass)) errors.push('Al menos un símbolo');
    return { ok: errors.length === 0, errors };
  },

  /** Cambia la contraseña del usuario indicado */
  setPassword(userId, newPassword) {
    const check = this.validatePassword(newPassword);
    if (!check.ok) throw new Error('Contraseña débil: ' + check.errors.join(', '));
    const user = this.getById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    return DB.update('usuarios', userId, { password: newPassword });
  },

  /** Crea un usuario Técnico o Supervisor */
  createUser({ nombre, email, rol, password }) {
    if (!nombre || !email || !rol || !password) {
      throw new Error('Nombre, email, rol y contraseña son obligatorios');
    }
    const rolOK = ['Tecnico', 'Supervisor'].includes(rol);
    if (!rolOK) throw new Error('Rol inválido (usa Técnico o Supervisor)');

    const exists = this.getByEmail(email);
    if (exists) throw new Error('Ya existe un usuario con ese email');

    const passChk = this.validatePassword(password);
    if (!passChk.ok) throw new Error('Contraseña débil: ' + passChk.errors.join(', '));

    const prefix = rol === 'Tecnico' ? 'u-tech-' : 'u-sup-';
    const id = prefix + slugFromEmail(email);

    const nuevo = { id, nombre, email: String(email).trim(), rol, password };
    DB.insert('usuarios', nuevo);
    return nuevo;
  },

  /** Elimina un usuario por id (no elimina empleados auto-creados salvo que se indique su id) */
  deleteUser(userId) {
    const user = this.getById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    // Seguridad básica: no permitir borrar si es el único supervisor
    if (user.rol === 'Supervisor') {
      const sups = this.getByRole('Supervisor');
      if (sups.length <= 1) throw new Error('No puedes eliminar al único Supervisor');
    }
    return DB.delete('usuarios', userId);
  },

  // ====== NUEVO: verificación de contraseña ======
  /**
   * Verifica la contraseña comparando texto plano (demo).
   * En producción deberías almacenar/validar hashes (bcrypt, etc.).
   */
  verifyPassword(userId, password) {
    const u = this.getById(userId);
    if (!u) return false;
    return String(u.password || '') === String(password || '');
  },

  /** Conveniencia: verifica por email en lugar de por id */
  verifyPasswordByEmail(email, password) {
    const u = this.getByEmail(email);
    if (!u) return false;
    return this.verifyPassword(u.id, password);
  }
};
