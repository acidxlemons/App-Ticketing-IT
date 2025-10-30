import { UsersService } from '../services/users.js';

export function renderTicketTable(tickets, actions = {}) {
  if (tickets.length === 0) {
    return '<div class="table-empty">No hay tickets para mostrar</div>';
  }
  return `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Número</th>
            <th>Título</th>
            <th>Estado</th>
            <th>Urgencia</th>
            <th>Prioridad</th>
            <th>Técnico</th>
            <th>Fecha Creación</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${tickets.map(ticket => renderTicketRow(ticket, actions)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTicketRow(ticket, actions) {
  const tecnico = ticket.tecnicoAsignadoId
    ? UsersService.getById(ticket.tecnicoAsignadoId)
    : null;

  return `
    <tr>
      <td><strong>${ticket.ticketNumber}</strong></td>
      <td>${escapeHtml(ticket.titulo)}</td>
      <td>${renderBadge('estado', ticket.estado)}</td>
      <td>${renderBadge('urgencia', ticket.urgencia)}</td>
      <td>${ticket.prioridad ? renderBadge('prioridad', ticket.prioridad) : '-'}</td>
      <td>${tecnico ? tecnico.nombre : 'Sin asignar'}</td>
      <td>${formatDate(ticket.fechaCreacion)}</td>
      <td>
        <div class="table-actions">
          ${actions.view ? `
            <button class="btn btn-sm btn-primary"
                    data-action="view"
                    data-id="${ticket.id}"
                    aria-label="Ver detalles de ${ticket.ticketNumber}">
              Ver
            </button>` : ''}
          ${actions.edit ? `
            <button class="btn btn-sm btn-secondary"
                    data-action="edit"
                    data-id="${ticket.id}"
                    aria-label="Editar ${ticket.ticketNumber}">
              Editar
            </button>` : ''}
          ${actions.delete ? `
            <button class="btn btn-sm btn-danger"
                    data-action="delete"
                    data-id="${ticket.id}"
                    aria-label="Eliminar ${ticket.ticketNumber}">
              Eliminar
            </button>` : ''}
        </div>
      </td>
    </tr>
  `;
}

export function renderBadge(type, value) {
  const className = `badge badge-${type}-${String(value).replace(/\s+/g, '')}`;
  return `<span class="${className}">${value}</span>`;
}

export function formatDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
