import { AuthService } from '../../auth.js';
import { TicketsService } from '../../services/tickets.js';
import { UsersService } from '../../services/users.js';
import { renderTicketTable, renderBadge, formatDate, escapeHtml } from '../../components/TicketTable.js';
import { NotificationService } from '../../services/notifications.js';

// Cambia si tu notifier corre en otra IP/puerto
const UPLOAD_BASE = 'http://10.0.0.90:3001';

export const TecnicoPage = {
  render(route, container){
    switch(route){
      case 'asignados':
        this.renderListado(container, { tecnicoAsignadoId: AuthService.getCurrentUser().id }, 'Asignados a mí');
        break;
      case 'todos':
        this.renderListado(container, {}, 'Todos abiertos', t=> t.estado!=='Resuelto');
        break;
      case 'en-espera':
        this.renderListado(container, { estado:'En espera' }, 'En espera'); 
        break;
      case 'escalados':
        this.renderListado(container, { estado:'Escalado' }, 'Escalados'); 
        break;
      default:
        this.renderListado(container, { tecnicoAsignadoId: AuthService.getCurrentUser().id }, 'Asignados a mí');
    }
  },

  renderListado(container, filters, title, extraFilter){
    let tickets = TicketsService.query(filters);
    if(extraFilter) tickets = tickets.filter(extraFilter);

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h2 class="card-title">${title}</h2></div>
        <div class="card-body">
          <div class="filters-bar">
            <div class="search-box"><span class="search-icon">🔍</span>
              <input id="search" class="form-input" placeholder="Buscar...">
            </div>
            <div class="form-group">
              <select id="filter-estado" class="form-select">
                <option value="">Todos los estados</option>
                <option>Abierto</option><option>En espera</option><option>Escalado</option><option>En curso</option><option>Resuelto</option>
              </select>
            </div>
            <div class="form-group">
              <select id="filter-prioridad" class="form-select">
                <option value="">Todas las prioridades</option>
                <option>Baja</option><option>Normal</option><option>Alta</option><option>Crítica</option>
              </select>
            </div>
          </div>
          <div id="tickets-list">${renderTicketTable(tickets, { view:true, edit:true, delete:true })}</div>
        </div>
      </div>`;

    const apply = ()=>{
      const s  = document.getElementById('search').value.toLowerCase();
      const fe = document.getElementById('filter-estado').value;
      const fp = document.getElementById('filter-prioridad').value;
      let list = TicketsService.query({...filters});
      if(extraFilter) list = list.filter(extraFilter);
      if(s)  list = list.filter(t => (t.ticketNumber+t.titulo+t.descripcion).toLowerCase().includes(s));
      if(fe) list = list.filter(t => t.estado===fe);
      if(fp) list = list.filter(t => t.prioridad===fp);
      document.getElementById('tickets-list').innerHTML = renderTicketTable(list, { view:true, edit:true, delete:true });
      this.attachRowEvents();
    };

    document.getElementById('search').addEventListener('input', apply);
    document.getElementById('filter-estado').addEventListener('change', apply);
    document.getElementById('filter-prioridad').addEventListener('change', apply);

    this.attachRowEvents();
  },

  attachRowEvents(){
    // Ver (solo lectura)
    document.querySelectorAll('[data-action="view"]').forEach(btn=>{
      btn.addEventListener('click', (e)=> this.showEditModal(e.currentTarget.dataset.id, false));
    });
    // Editar (editable)
    document.querySelectorAll('[data-action="edit"]').forEach(btn=>{
      btn.addEventListener('click', (e)=> this.showEditModal(e.currentTarget.dataset.id, true));
    });
    // Eliminar
    document.querySelectorAll('[data-action="delete"]').forEach(btn=>{
      btn.addEventListener('click', (e)=> this.confirmDelete(e.currentTarget.dataset.id));
    });
  },

  confirmDelete(ticketId){
    const t = TicketsService.getById(ticketId);
    if (!t) return;
    if (!confirm(`¿Eliminar definitivamente el ticket ${t.ticketNumber}?\nEsta acción no se puede deshacer.`)) return;
    try{
      TicketsService.remove(ticketId);
      NotificationService.show('Ticket eliminado', `${t.ticketNumber} eliminado`, 'success');
      // refrescar la vista actual (re-click en la tab activa)
      document.querySelector('.nav-link.active')?.click();
    }catch(err){
      NotificationService.show('Error', err.message, 'error');
    }
  },

  showEditModal(ticketId, editable){
    const ticket = TicketsService.getById(ticketId);
    if(!ticket){ NotificationService.show('Error','Ticket no encontrado','error'); return; }
    const historial = TicketsService.getHistorial(ticketId);
    const tecnicos = UsersService.getTecnicos();

    const attachmentsHtml = (ticket.attachments || []).length
      ? `<ul>${ticket.attachments.map(a => `
            <li>
              <a href="${UPLOAD_BASE}${a.url}" target="_blank" rel="noopener" download>
                ${escapeHtml(a.originalname || a.filename)} (${Math.round((a.size||0)/1024)} KB)
              </a>
            </li>`).join('')}
         </ul>`
      : '<div class="detail-value">Sin adjuntos</div>';

    const modal = `
      <div class="modal-overlay" id="modal-tech">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle">
          <div class="modal-header">
            <h3 class="modal-title" id="mtitle">${editable ? 'Editar' : 'Detalle'} — ${ticket.ticketNumber}</h3>
            <button class="modal-close" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="ticket-detail-grid">
              <div class="detail-item">
                <span class="detail-label">Urgencia</span>
                <span class="detail-value">${
                  editable ? `
                  <select id="f-urgencia" class="form-select">
                    ${['Poca','Media','Urgente'].map(op=>`<option ${ticket.urgencia===op?'selected':''}>${op}</option>`).join('')}
                  </select>` : renderBadge('urgencia', ticket.urgencia)
                }</span>
              </div>

              <div class="detail-item">
                <span class="detail-label">Estado</span>
                <span class="detail-value">${
                  editable ? `
                  <select id="f-estado" class="form-select">
                    ${['Abierto','En espera','Escalado','En curso','Resuelto'].map(op=>`<option ${ticket.estado===op?'selected':''}>${op}</option>`).join('')}
                  </select>` : renderBadge('estado', ticket.estado)
                }</span>
              </div>

              <div class="detail-item">
                <span class="detail-label">Prioridad (empleado)</span>
                <span class="detail-value">${ticket.prioridad ? renderBadge('prioridad', ticket.prioridad) : 'No asignada'}</span>
              </div>

              <div class="detail-item">
                <span class="detail-label">Técnico asignado</span>
                <span class="detail-value">${
                  editable ? `
                  <select id="f-tecnico" class="form-select">
                    <option value="">Sin asignar</option>
                    ${tecnicos.map(t=>`<option value="${t.id}" ${ticket.tecnicoAsignadoId===t.id?'selected':''}>${escapeHtml(t.nombre)}</option>`).join('')}
                  </select>` : (ticket.tecnicoAsignadoId ? (tecnicos.find(t=>t.id===ticket.tecnicoAsignadoId)?.nombre || '-') : 'Sin asignar')
                }</span>
              </div>

              <div class="detail-item">
                <span class="detail-label">Fecha cierre</span>
                <span class="detail-value">${
                  editable ? `
                  <input id="f-cierre" class="form-input" type="datetime-local" value="${ticket.fechaCierre ? toLocalInput(ticket.fechaCierre) : ''}" ${ticket.estado==='Resuelto'?'required':''}/>
                  <small class="form-help">Obligatoria al resolver</small>
                  ` : (ticket.fechaCierre ? formatDate(ticket.fechaCierre) : 'Pendiente')
                }</span>
              </div>

              <div class="detail-item">
                <span class="detail-label">Tiempo dedicado (min)</span>
                <span class="detail-value">${
                  editable ? `
                  <div class="form-inline">
                    <input id="f-tiempo-add" type="number" min="0" class="form-input" placeholder="+ minutos"/>
                    <button class="btn btn-secondary" id="btn-add-time" type="button">Añadir minutos</button>
                  </div>
                  <div class="form-help">Acumulado actual: <strong id="tiempo-actual">${ticket.tiempoDedicadoMin || 0}</strong> min</div>
                  ` : `${ticket.tiempoDedicadoMin || 0} min`
                }</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Adjuntos</label>
              ${attachmentsHtml}
            </div>

            <div class="form-group">
              <label class="form-label">Acciones (notas del técnico)</label>
              ${editable ? `<textarea id="f-acciones" class="form-textarea" maxlength="4000">${escapeHtml(ticket.acciones || '')}</textarea>`
                         : `<div class="detail-value">${escapeHtml(ticket.acciones || '-')}</div>`}
            </div>

            <hr class="section-divider"/>
            <h4 style="margin-bottom:.5rem;">Historial</h4>
            <div class="timeline">
              ${historial.map(h => `
                <div class="timeline-item">
                  <div class="timeline-date">${formatDate(h.fecha)}</div>
                  <div class="timeline-event">${escapeHtml(h.tipoEvento)}</div>
                  <div class="timeline-detail">${escapeHtml(h.detalle)}</div>
                </div>`).join('')}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="btn-close" type="button">Cerrar</button>
            ${editable ? `
              <button class="btn btn-warning" id="btn-request" type="button">Solicitar información</button>
              <button class="btn btn-primary" id="btn-save" type="button">Guardar cambios</button>
            ` : ``}
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modal);
    const overlay = document.getElementById('modal-tech');
    const close = ()=> overlay.remove();
    const $ = sel => overlay.querySelector(sel);

    $('.modal-close').addEventListener('click', close);
    $('#btn-close').addEventListener('click', close);
    overlay.addEventListener('click', (e)=>{ if(e.target.id==='modal-tech') close(); });

    if(!editable) return;

    // Añadir minutos
    $('#btn-add-time').addEventListener('click', ()=>{
      const val = parseInt($('#f-tiempo-add').value, 10);
      if(Number.isNaN(val) || val<0){
        NotificationService.show('Dato inválido','Introduce un número entero ≥ 0','error'); return;
      }
      try{
        const updated = TicketsService.addTime(ticketId, val);
        $('#tiempo-actual').textContent = updated.tiempoDedicadoMin;
        $('#f-tiempo-add').value = '';
        NotificationService.show('Tiempo acumulado', `+${val} min añadidos`, 'success');
      }catch(err){ NotificationService.show('Error', err.message, 'error'); }
    });

    // Validación al cambiar estado
    $('#f-estado').addEventListener('change', (e)=>{
      if(e.target.value==='Resuelto') $('#f-cierre').setAttribute('required','required');
      else $('#f-cierre').removeAttribute('required');
    });

    // Guardar cambios
    $('#btn-save').addEventListener('click', ()=>{
      const patch = {
        // técnico puede editar urgencia, estado, técnico asignado, acciones
        urgencia: $('#f-urgencia').value,
        estado: $('#f-estado').value,
        tecnicoAsignadoId: $('#f-tecnico').value || null,
        acciones: $('#f-acciones').value
      };
      if(patch.estado==='Resuelto'){
        const dt = $('#f-cierre').value;
        if(!dt){ NotificationService.show('Falta fecha de cierre','Para resolver, indica fecha y hora','error'); return; }
        patch.fechaCierre = fromLocalInput(dt);
      }
      try{
        TicketsService.update(ticketId, patch);
        NotificationService.show('Ticket actualizado', `${ticket.ticketNumber} guardado`, 'success');
        close();
        document.querySelector('.nav-link.active')?.click();
      }catch(err){ NotificationService.show('Error', err.message, 'error'); }
    });

    // Solicitar información
    $('#btn-request').addEventListener('click', ()=>{
      const mensaje = prompt('Mensaje para el empleado:', 'Por favor, amplía la descripción...');
      if(mensaje===null) return;
      try{
        TicketsService.requestInformation(ticketId, mensaje);
        NotificationService.show('Solicitud enviada','Se pidió información adicional','info');
        close();
        document.querySelector('.nav-link.active')?.click();
      }catch(err){ NotificationService.show('Error', err.message, 'error'); }
    });
  }
};

// ================= Helpers de fecha para inputs =================
function toLocalInput(iso){
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(val){
  const d = new Date(val);
  return d.toISOString();
}
