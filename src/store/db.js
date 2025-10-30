/**
 * Capa de acceso a datos en localStorage (robusta y con migración)
 */
const DB_KEY = 'ticketSystemDB';

const initialDB = {
  tickets: [],
  historial: [],
  usuarios: [
    // Técnicos con credenciales
    { id:'u-tech-ica', nombre:'I. Cabañas',       email:'icabanas@europavia.es',      rol:'Tecnico',   password:'T3ch#2025!' },
    { id:'u-tech-amb', nombre:'A. Ballesteros',   email:'amballesteros@europavia.es', rol:'Tecnico',   password:'Ev@Tech#42' },
    // Supervisor
    { id:'u-sup-gf',   nombre:'G. Fernández',     email:'gfernandez@europavia.es',    rol:'Supervisor', password:'Sup3r#2025' }
  ],
  config: {
    ticketCounter: 0,     // empezamos en 0; el primer increment devuelve 1
    version: 3
  }
};

export function initDB() {
  const existing = localStorage.getItem(DB_KEY);

  if (!existing) {
    localStorage.setItem(DB_KEY, JSON.stringify(initialDB));
    return;
  }

  // Migración/normalización: nunca sobrescribimos, sólo completamos lo que falte
  try {
    const db = JSON.parse(existing) || {};
    if (!Array.isArray(db.tickets))   db.tickets   = [];
    if (!Array.isArray(db.historial)) db.historial = [];
    if (!Array.isArray(db.usuarios))  db.usuarios  = [];

    // Asegurar técnicos/supervisor (si faltan, los añadimos una vez)
    const ensureUserByEmail = (u) => {
      const exists = db.usuarios.some(x => String(x.email).toLowerCase() === u.email.toLowerCase());
      if (!exists) db.usuarios.push(u);
    };
    initialDB.usuarios.forEach(ensureUserByEmail);

    // Config básica
    if (!db.config || typeof db.config !== 'object') db.config = {};
    if (typeof db.config.ticketCounter !== 'number' || isNaN(db.config.ticketCounter)) {
      db.config.ticketCounter = 0;
    }
    db.config.version = 3;

    // Si hay tickets, calcular el máximo correlativo para no retroceder
    const maxSeq = db.tickets.reduce((m, t) => {
      const n = parseInt((t.ticketNumber || '').replace('TCK-', ''), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);

    if (db.config.ticketCounter < maxSeq) {
      db.config.ticketCounter = maxSeq; // el próximo será maxSeq+1
    }

    saveDB(db);
  } catch {
    // Si algo raro hubiera en el JSON, reinicializamos con estructura limpia
    localStorage.setItem(DB_KEY, JSON.stringify(initialDB));
  }
}

export function getDB() {
  const raw = localStorage.getItem(DB_KEY);
  return raw ? JSON.parse(raw) : { ...initialDB };
}

export function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// Utilidades de acceso
export const DB = {
  getAll(collection) {
    const db = getDB();
    return db[collection] || [];
  },

  getById(collection, id) {
    const items = this.getAll(collection);
    return items.find(item => item.id === id);
  },

  insert(collection, item) {
    const db = getDB();
    if (!Array.isArray(db[collection])) db[collection] = [];
    db[collection].push(item);
    saveDB(db);
    return item;
  },

  update(collection, id, updates) {
    const db = getDB();
    const idx = (db[collection] || []).findIndex(x => x.id === id);
    if (idx !== -1) {
      db[collection][idx] = { ...db[collection][idx], ...updates };
      saveDB(db);
      return db[collection][idx];
    }
    return null;
  },

  delete(collection, id) {
    const db = getDB();
    const idx = (db[collection] || []).findIndex(x => x.id === id);
    if (idx !== -1) {
      db[collection].splice(idx, 1);
      saveDB(db);
      return true;
    }
    return false;
  },

  query(collection, predicate) {
    return this.getAll(collection).filter(predicate);
  },

  /**
   * Incrementa y devuelve el NUEVO contador (1,2,3,...)
   * Con esto el primer ticket será TCK-000001, y nunca se repetirá al recargar.
   */
  incrementCounter() {
    const db = getDB();
    if (!db.config) db.config = { ticketCounter: 0, version: 3 };
    if (typeof db.config.ticketCounter !== 'number' || isNaN(db.config.ticketCounter)) {
      db.config.ticketCounter = 0;
    }
    db.config.ticketCounter += 1;
    saveDB(db);
    return db.config.ticketCounter; // devolvemos el nuevo valor
  }
};
