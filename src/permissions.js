/**
 * Sistema de permisos basado en roles
 */

const PERMISSIONS = {
  // Empleado
  Empleado: {
    tickets: {
      create: true,
      viewOwn: true,
      viewAll: false,
      // urgencia la edita el técnico; el empleado fija prioridad al crear
      editUrgencia: false,
      editComentarios: true, // solo si no está resuelto
      editEstado: false,
      editPrioridad: false,
      editTecnico: false,
      editAcciones: false,
      editTiempo: false,
      editFechaCierre: false,
      delete: false
    },
    dashboard: false
  },

  // Técnico
  Tecnico: {
    tickets: {
      create: false,
      viewOwn: true,
      viewAll: true,
      editUrgencia: true,       // ← puede cambiar urgencia
      editComentarios: false,
      editEstado: true,
      editPrioridad: false,     // prioridad la fija el empleado
      editTecnico: true,        // reasignar técnico
      editAcciones: true,
      editTiempo: true,
      editFechaCierre: true,
      delete: true              // ← puede eliminar tickets
    },
    dashboard: false
  },

  // Supervisor
  Supervisor: {
    tickets: {
      create: false,
      viewOwn: false,
      viewAll: true,
      editUrgencia: false,
      editComentarios: false,
      editEstado: false,
      editPrioridad: false,
      editTecnico: true,        // puede asignar técnico
      editAcciones: false,
      editTiempo: false,
      editFechaCierre: false,
      delete: true              // ← puede eliminar tickets
    },
    dashboard: true
  }
};

export const PermissionsService = {
  can(user, resource, action) {
    if (!user || !user.rol) return false;
    const rolePermissions = PERMISSIONS[user.rol];
    if (!rolePermissions) return false;
    const resourcePermissions = rolePermissions[resource];
    if (!resourcePermissions) return false;
    return resourcePermissions[action] === true;
  },

  authorize(user, resource, action) {
    if (!this.can(user, resource, action)) {
      throw new Error(`Acceso denegado: no tienes permiso para ${action} en ${resource}`);
    }
  },

  canEditComentarios(user, ticket) {
    if (user.rol !== 'Empleado') return false;
    if (ticket.empleadoCreadorId !== user.id) return false;
    if (ticket.estado === 'Resuelto') return false;
    return true;
  },

  canEditTicketField(user, field) {
    const fieldPermissionMap = {
      'estado': 'editEstado',
      'prioridad': 'editPrioridad',
      'urgencia': 'editUrgencia',           // ← añadido
      'tecnicoAsignadoId': 'editTecnico',
      'acciones': 'editAcciones',
      'tiempoDedicadoMin': 'editTiempo',
      'fechaCierre': 'editFechaCierre'
    };
    const permission = fieldPermissionMap[field];
    return permission ? this.can(user, 'tickets', permission) : false;
  }
};
