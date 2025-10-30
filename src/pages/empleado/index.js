import { AuthService } from '../../auth.js';
import { TicketsService } from '../../services/tickets.js';
import { renderTicketTable, renderBadge, formatDate, escapeHtml } from '../../components/TicketTable.js';
import { NotificationService } from '../../services/notifications.js';
import { Router } from '../../router.js';

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

// Cambia esta base si tu notifier corre en otra IP/puerto
const UPLOAD_BASE = 'http://10.0.0.90:3001';

export const EmpleadoPage = {
  render(route, container){
    switch(route){
      case 'mis-tickets':   this.renderMisTickets(container); break;
      case 'crear-ticket':  this.renderCrearTicket(container); break;
      default:              this.renderMisTickets(container);
    }
  },

  renderMisTickets(container){
    const user = AuthService.getCurrentUser();
    const base = TicketsService.getForEmployee(user); // ← tickets por id O email

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h2 class="card-title">Mis Tickets</h2></div>
        <div class="card-body">
          <div class="filters-bar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input id="search-input" class="form-input" placeholder="Buscar por número o título..." aria-label="Buscar tickets"/>
            </div>
            <div class="form-group">
              <select id="filter-estado" class="form-select" aria-label="Filtrar por estado">
                <option value="">Todos los estados</option>
                <option>Abierto</option><option>En espera</option><option>Escalado</option><option>En curso</option><option>Resuelto</option>
              </select>
            </div>
            <div class="form-group">
              <select id="filter-urgencia" class="form-select" aria-label="Filtrar por urgencia">
                <option value="">Todas las urgencias</option>
                <option>Poca</option><option>Media</option><option>Urgente</option>
              </select>
            </div>
          </div>
          <div id="tickets-list">${renderTicketTable(base, { view:true })}</div>
        </div>
      </div>`;

    this.setupMisTicketsListeners();
  },

  setupMisTicketsListeners(){
    const user = AuthService.getCurrentUser();
    const searchInput = document.getElementById('search-input');
    const filterEstado = document.getElementById('filter-estado');
    const filterUrgencia = document.getElementById('filter-urgencia');

    const apply = ()=>{
      let list = TicketsService.getForEmployee(user);  // ← conjunto base
      const s = (searchInput.value || '').toLowerCase();
      const fe = filterEstado.value;
      const fu = filterUrgencia.value;

      if (s) list = list.filter(t =>
        (t.ticketNumber + ' ' + t.titulo + ' ' + t.descripcion).toLowerCase().includes(s)
      );
      if (fe) list = list.filter(t => t.estado === fe);
      if (fu) list = list.filter(t => t.urgencia === fu);

      document.getElementById('tickets-list').innerHTML = renderTicketTable(list, { view:true });
      document.querySelectorAll('[data-action="view"]').forEach(btn=>{
        btn.addEventListener('click', (e)=> this.showTicketDetail(e.currentTarget.dataset.id));
      });
    };

    searchInput.addEventListener('input', apply);
    filterEstado.addEventListener('change', apply);
    filterUrgencia.addEventListener('change', apply);

    document.querySelectorAll('[data-action="view"]').forEach(btn=>{
      btn.addEventListener('click', (e)=> this.showTicketDetail(e.currentTarget.dataset.id));
    });
  },

  showTicketDetail(ticketId){
    const ticket = TicketsService.getById(ticketId);
    const historial = TicketsService.getHistorial(ticketId);
    const canEditComments = ticket.estado !== 'Resuelto';

    const attachmentsHtml = (ticket.attachments || []).length
      ? `<ul>${ticket.attachments.map(a => `
            <li>
              <a href="${UPLOAD_BASE}${a.url}" target="_blank" rel="noopener" download>
                ${escapeHtml(a.originalname || a.filename)} (${Math.round((a.size||0)/1024)} KB)
              </a>
            </li>`).join('')}
         </ul>`
      : '<div class="detail-value">Sin adjuntos</div>';

    const modalHTML = `
      <div class="modal-overlay" id="modal-detail">
        <div class="modal" role="dialog" aria-labelledby="modal-title" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title" id="modal-title">Detalle del Ticket ${ticket.ticketNumber}</h3>
            <button class="modal-close" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="ticket-detail-grid">
              <div class="detail-item"><span class="detail-label">Estado</span><span class="detail-value">${renderBadge('estado', ticket.estado)}</span></div>
              <div class="detail-item"><span class="detail-label">Urgencia</span><span class="detail-value">${renderBadge('urgencia', ticket.urgencia)}</span></div>
              <div class="detail-item"><span class="detail-label">Prioridad</span><span class="detail-value">${ticket.prioridad ? renderBadge('prioridad', ticket.prioridad) : 'No asignada'}</span></div>
              <div class="detail-item"><span class="detail-label">Fecha Creación</span><span class="detail-value">${formatDate(ticket.fechaCreacion)}</span></div>
              <div class="detail-item"><span class="detail-label">Fecha Cierre</span><span class="detail-value">${ticket.fechaCierre ? formatDate(ticket.fechaCierre) : 'Pendiente'}</span></div>
            </div>
            <hr class="section-divider">
            <div class="form-group">
              <label class="form-label">Título</label>
              <div class="detail-value">${escapeHtml(ticket.titulo)}</div>
            </div>
            <div class="form-group">
              <label class="form-label">Descripción</label>
              <div class="detail-value">${escapeHtml(ticket.descripcion)}</div>
            </div>

            <div class="form-group">
              <label class="form-label">Adjuntos</label>
              ${attachmentsHtml}
            </div>

            <div class="form-group">
              <label class="form-label">Mis Comentarios</label>
              <textarea class="form-textarea" id="comentarios-empleado" ${canEditComments?'':'disabled'} placeholder="Agrega comentarios...">${escapeHtml(ticket.comentariosEmpleado || '')}</textarea>
              ${!canEditComments ? '<p class="form-help">No puedes editar comentarios de tickets resueltos</p>' : ''}
            </div>

            ${ticket.acciones ? `
              <div class="form-group">
                <label class="form-label">Acciones del Técnico</label>
                <div class="detail-value">${escapeHtml(ticket.acciones)}</div>
              </div>` : ''}

            <hr class="section-divider">
            <h4 style="margin-bottom:.5rem;">Historial</h4>
            <div class="timeline" id="historial">
              ${historial.map(h => `
                <div class="timeline-item">
                  <div class="timeline-date">${formatDate(h.fecha)}</div>
                  <div class="timeline-event">${escapeHtml(h.tipoEvento)}</div>
                  <div class="timeline-detail">${escapeHtml(h.detalle)}</div>
                </div>`).join('')}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="btn-close">Cerrar</button>
            <button class="btn btn-primary" id="btn-save" ${canEditComments?'':'disabled'}>Guardar comentarios</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const overlay = document.getElementById('modal-detail');
    const close = ()=> overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#btn-close').addEventListener('click', close);
    overlay.addEventListener('click', (e)=>{ if(e.target.id==='modal-detail') close(); });

    overlay.querySelector('#btn-save')?.addEventListener('click', ()=>{
      const comentarios = overlay.querySelector('#comentarios-empleado').value;
      try{
        TicketsService.update(ticketId, { comentariosEmpleado: comentarios });
        NotificationService.show('Comentarios guardados', 'Se actualizaron tus comentarios.', 'success');
        close();
      }catch(err){
        NotificationService.show('Error', err.message, 'error');
      }
    });
  },

  renderCrearTicket(container){
    const user = AuthService.getCurrentUser();
    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h2 class="card-title">Crear Ticket</h2></div>
        <div class="card-body">
          <form id="form-crear" novalidate>
            <div class="form-group">
              <label class="form-label required" for="titulo">Título</label>
              <input id="titulo" class="form-input" required maxlength="200"/>
              <small class="form-help">Máx. 200 caracteres</small>
            </div>
            <div class="form-group">
              <label class="form-label required" for="descripcion">Descripción</label>
              <textarea id="descripcion" class="form-textarea" required></textarea>
            </div>
            <div class="form-group">
              <label class="form-label required" for="prioridad">Prioridad (asignada por empleado)</label>
              <select id="prioridad" class="form-select" required>
                <option value="">Selecciona…</option>
                <option>Baja</option><option>Normal</option><option>Alta</option><option>Crítica</option>
              </select>
            </div>
            <!-- Urgencia no se pide al empleado -->
            <div class="form-group">
              <label class="form-label required" for="correo">Correo del empleado</label>
              <input id="correo" class="form-input" type="email" value="${user.email || ''}" required/>
              <small class="form-help">Puedes cambiarlo si es necesario</small>
            </div>
            <div class="form-group">
              <label class="form-label" for="categoria">Categoría</label>
              <select id="categoria" class="form-select">
                ${CATEGORIAS.map(c => `<option>${c}</option>`).join('')}
              </select>
            </div>

            <!-- NUEVO: Adjuntos -->
            <div class="form-group">
              <label class="form-label" for="attachments">Adjuntar archivos (opcional)</label>
              <input id="attachments" class="form-input" type="file" multiple
                accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt" />
              <small class="form-help">Hasta 10MB por archivo. Formatos: imágenes, PDF, Office, TXT.</small>
            </div>

            <div class="form-group">
              <label class="form-label" for="comentarios">Mis comentarios (opcional)</label>
              <textarea id="comentarios" class="form-textarea" maxlength="2000"></textarea>
            </div>
            <div class="btn-group">
              <button class="btn btn-primary" type="submit">Crear</button>
              <button class="btn btn-outline" type="reset">Limpiar</button>
            </div>
          </form>
        </div>
      </div>`;

    document.getElementById('form-crear').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = {
        titulo: document.getElementById('titulo').value.trim(),
        descripcion: document.getElementById('descripcion').value.trim(),
        prioridad: document.getElementById('prioridad').value,
        correoEmpleado: document.getElementById('correo').value.trim(),
        categoria: document.getElementById('categoria').value,
        comentariosEmpleado: document.getElementById('comentarios').value.trim()
      };

      try{
        // 1) Subir adjuntos si hay
        const input = document.getElementById('attachments');
        let attachments = [];
        if (input.files && input.files.length) {
          const fd = new FormData();
          for (const f of input.files) fd.append('files', f);
          const resp = await fetch(`${UPLOAD_BASE}/upload`, { method: 'POST', body: fd });
          if (!resp.ok) throw new Error('Error subiendo archivos');
          const json = await resp.json();
          if (!json.ok) throw new Error(json.error || 'Error subiendo archivos');
          attachments = json.files || [];
        }

        // 2) Crear ticket con attachments
        data.attachments = attachments;
        const t = TicketsService.create(data);
        NotificationService.show('Ticket creado', `Se creó ${t.ticketNumber}`, 'success');

        const link = document.querySelector('.nav-link[data-route="mis-tickets"]');
        if (link) link.click(); else { Router.init(); Router.navigate('mis-tickets'); }
      }catch(err){
        NotificationService.show('Error', err.message, 'error');
      }
    });
  }
};
