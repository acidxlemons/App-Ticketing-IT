import { DB, getDB, saveDB } from '../store/db.js';
import { AuthService } from '../auth.js';
import { PermissionsService } from '../permissions.js';
import { NotificationService } from './notifications.js';

const CATEGORIAS = [
  'Teclado/Ratón',
  'PowerBI',
  'Dispositivos Electrónicos',
  'Cables',
  'Apps',
  'X3',
  '365 Apps',
  'Otros'
];
const PRIORIDADES = ['Baja', 'Normal', 'Alta', 'Crítica'];
const URGENCIAS   = ['Poca', 'Media', 'Urgente'];

function seqFromTicketNumber(tn) {
  const n = parseInt(String(tn || '').replace('TCK-',''), 10);
  return Number.isFinite(n) ? n : 0;
}

export const TicketsService = {
  /** Siguiente secuencia = max(tickets existentes) + 1. */
  nextSequence() {
    const all = DB.getAll('tickets');
    const maxSeq = all.reduce((m, t) => {
      const n = seqFromTicketNumber(t.ticketNumber);
      return n > m ? n : m;
    }, 0);
    return maxSeq + 1; // primer ticket => 1
  },

  create(data) {
    const user = AuthService.getCurrentUser();
    PermissionsService.authorize(user, 'tickets', 'create');

    this.validateTicketData(data, true);

    const seq = this.nextSequence();
    const ticketNumber = `TCK-${String(seq).padStart(6, '0')}`;

    const ticket = {
      id: 't-' + Date.now(),
      ticketNumber,
      titulo: data.titulo,
      descripcion: data.descripcion,
      empleadoCreadorId: user.id,
      tecnicoAsignadoId: null,
      prioridad: data.prioridad,                  // la fija el empleado
      urgencia: 'Media',                          // por defecto; técnico la puede cambiar
      estado: 'Abierto',
      fechaCreacion: new Date().toISOString(),
      fechaCierre: null,
      tiempoDedicadoMin: 0,
      acciones: '',
      correoEmpleado: data.correoEmpleado,
      comentariosEmpleado: data.comentariosEmpleado || '',
      categoria: data.categoria || 'Otros',
      // NUEVO: adjuntos subidos por el empleado al crear
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    };

    DB.insert('tickets', ticket);
    this.addHistorial(ticket.id, user.id, 'Creacion', `Ticket creado: ${ticket.titulo}`);
    NotificationService.notifyTicketCreated(ticket);
    return ticket;
  },

  update(ticketId, updates) {
    const user = AuthService.getCurrentUser();
    const ticket = this.getById(ticketId);
    if (!ticket) throw new Error('Ticket no encontrado');

    // Permisos por campo
    Object.keys(updates).forEach(field => {
      if (field === 'comentariosEmpleado') {
        if (!PermissionsService.canEditComentarios(user, ticket)) {
          throw new Error('No puedes editar comentarios de este ticket');
        }
      } else if (field === 'attachments') {
        // No permitimos modificar adjuntos desde update estándar.
        throw new Error('Los adjuntos no se pueden modificar en esta operación');
      } else if (!PermissionsService.canEditTicketField(user, field)) {
        throw new Error(`No tienes permiso para editar el campo: ${field}`);
      }
    });

    // Validación de cierre
    if (updates.estado === 'Resuelto' && !updates.fechaCierre && !ticket.fechaCierre) {
      throw new Error('La fecha de cierre es obligatoria para resolver un ticket');
    }

    const updatedTicket = DB.update('tickets', ticketId, updates);

    // Historial / notificaciones
    if (updates.estado) {
      this.addHistorial(ticketId, user.id, 'CambioEstado', `Estado cambiado a: ${updates.estado}`);
      if (updates.estado === 'Resuelto') {
        this.addHistorial(ticketId, user.id, 'Cierre', 'Ticket resuelto');
        NotificationService.notifyTicketResolved(updatedTicket);
      } else {
        NotificationService.notifyTicketStateChange(updatedTicket);
      }
    }

    if (updates.comentariosEmpleado !== undefined) {
      this.addHistorial(ticketId, user.id, 'ComentarioEmpleado', 'Comentario actualizado por el empleado');
    }

    if (
      updates.acciones ||
      updates.tiempoDedicadoMin !== undefined ||
      updates.urgencia !== undefined ||           // ← urgencia editada por técnico
      updates.tecnicoAsignadoId !== undefined
    ) {
      this.addHistorial(ticketId, user.id, 'ActualizacionTecnico', 'Ticket actualizado por técnico');
    }

    return updatedTicket;
  },

  /** Eliminar ticket (técnico/supervisor) + limpiar historial. */
  remove(ticketId) {
    const user = AuthService.getCurrentUser();
    PermissionsService.authorize(user, 'tickets', 'delete');

    const ticket = this.getById(ticketId);
    if (!ticket) throw new Error('Ticket no encontrado');

    // borrar ticket
    const ok = DB.delete('tickets', ticketId);
    if (!ok) throw new Error('No se pudo eliminar el ticket');

    // borrar historial asociado
    const db = getDB();
    db.historial = (db.historial || []).filter(h => h.ticketId !== ticketId);
    saveDB(db);

    return true;
  },

  getById(id) { return DB.getById('tickets', id); },
  getAll() { return DB.getAll('tickets'); },

  /** Tickets del empleado por ID o por email (case-insensitive) */
  getForEmployee(user) {
    const uid = user?.id;
    const email = (user?.email || '').toLowerCase();
    return this.getAll().filter(t =>
      t.empleadoCreadorId === uid ||
      (t.correoEmpleado && String(t.correoEmpleado).toLowerCase() === email)
    );
  },

  query(filters = {}) {
    let tickets = this.getAll();
    if (filters.empleadoCreadorId) tickets = tickets.filter(t => t.empleadoCreadorId === filters.empleadoCreadorId);
    if (filters.tecnicoAsignadoId) tickets = tickets.filter(t => t.tecnicoAsignadoId === filters.tecnicoAsignadoId);
    if (filters.estado) tickets = tickets.filter(t => t.estado === filters.estado);
    if (filters.urgencia) tickets = tickets.filter(t => t.urgencia === filters.urgencia);
    if (filters.prioridad) tickets = tickets.filter(t => t.prioridad === filters.prioridad);
    if (filters.categoria) tickets = tickets.filter(t => t.categoria === filters.categoria);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      tickets = tickets.filter(t =>
        t.ticketNumber.toLowerCase().includes(s) ||
        t.titulo.toLowerCase().includes(s) ||
        t.descripcion.toLowerCase().includes(s)
      );
    }
    return tickets;
  },

  addTime(ticketId, minutos) {
    const user = AuthService.getCurrentUser();
    PermissionsService.authorize(user, 'tickets', 'editTiempo');
    const ticket = this.getById(ticketId);
    if (!ticket) throw new Error('Ticket no encontrado');
    const nuevoTiempo = (ticket.tiempoDedicadoMin || 0) + minutos;
    return this.update(ticketId, { tiempoDedicadoMin: nuevoTiempo });
  },

  requestInformation(ticketId, mensaje) {
    const user = AuthService.getCurrentUser();
    PermissionsService.authorize(user, 'tickets', 'editEstado');
    const ticket = this.getById(ticketId);
    if (!ticket) throw new Error('Ticket no encontrado');

    this.update(ticketId, { estado: 'En espera' });
    this.addHistorial(ticketId, user.id, 'ActualizacionTecnico', `Información solicitada: ${mensaje}`);
    NotificationService.notifyInformationRequest(ticket, mensaje);
  },

  addHistorial(ticketId, autorId, tipoEvento, detalle) {
    const historial = {
      id: 'h-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      ticketId,
      autorId,
      tipoEvento,
      detalle,
      fecha: new Date().toISOString()
    };
    DB.insert('historial', historial);
    return historial;
  },

  getHistorial(ticketId) {
    return DB.query('historial', h => h.ticketId === ticketId)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },

  validateTicketData(data, isNew = false) {
    const errors = [];
    if (isNew) {
      if (!data.titulo || data.titulo.trim().length === 0) errors.push('El título es obligatorio');
      if (data.titulo && data.titulo.length > 200) errors.push('El título no puede exceder 200 caracteres');
      if (!data.descripcion || data.descripcion.trim().length === 0) errors.push('La descripción es obligatoria');

      if (!data.prioridad || !PRIORIDADES.includes(data.prioridad)) {
        errors.push('La prioridad es obligatoria');
      }
      if (!data.correoEmpleado || !this.validateEmail(data.correoEmpleado)) {
        errors.push('El correo electrónico es inválido');
      }
      if (data.categoria && !CATEGORIAS.includes(data.categoria)) {
        errors.push('La categoría no es válida');
      }
    }
    if (errors.length > 0) throw new Error(errors.join(', '));
  },

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
};
