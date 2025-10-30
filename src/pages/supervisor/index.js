import { AuthService } from '../../auth.js';
import { TicketsService } from '../../services/tickets.js';
import { UsersService } from '../../services/users.js';
import { renderTicketTable, renderBadge, formatDate, escapeHtml } from '../../components/TicketTable.js';
import { NotificationService } from '../../services/notifications.js';

const CATEGORIAS = [
  'Teclado/Ratón','PowerBI','Dispositivos Electrónicos','Cables','Apps','X3','365 Apps','Otros'
];

// Cambia si tu notifier corre en otra IP/puerto
const UPLOAD_BASE = 'http://10.0.0.90:3001';

export const SupervisorPage = {
  render(route, container) {
    switch (route) {
      case 'dashboard':
        this.renderDashboard(container);
        break;
      case 'tickets':
        this.renderTickets(container);
        break;
      case 'usuarios':
        this.renderUsuarios(container);
        break;
      default:
        this.renderDashboard(container);
    }
  },

  // ===================== DASHBOARD POTENCIADO =====================
  renderDashboard(container) {
    const tickets = TicketsService.getAll();
    const now = Date.now();

    const abiertos    = tickets.filter(t => t.estado !== 'Resuelto');
    const resueltos   = tickets.filter(t => t.estado === 'Resuelto' && t.fechaCierre);
    const enEspera    = tickets.filter(t => t.estado === 'En espera');
    const enCurso     = tickets.filter(t => t.estado === 'En curso');
    const escalados   = tickets.filter(t => t.estado === 'Escalado');

    // KPIs de tiempo de resolución
    const deltas = resueltos.map(t => new Date(t.fechaCierre) - new Date(t.fechaCreacion)).filter(n => Number.isFinite(n));
    const avg = deltas.length ? deltas.reduce((a,b)=>a+b,0) / deltas.length : 0;
    const median = (() => {
      if (!deltas.length) return 0;
      const s = [...deltas].sort((a,b)=>a-b);
      const mid = Math.floor(s.length/2);
      return s.length % 2 ? s[mid] : (s[mid-1]+s[mid])/2;
    })();

    // Antigüedad de abiertos (en días)
    const aging = abiertos.map(t => Math.floor((now - new Date(t.fechaCreacion).getTime()) / 86400000));
    const agingBuckets = { '0-2d':0, '3-7d':0, '8-14d':0, '15+d':0 };
    aging.forEach(d => {
      if (d <= 2) agingBuckets['0-2d']++;
      else if (d <= 7) agingBuckets['3-7d']++;
      else if (d <= 14) agingBuckets['8-14d']++;
      else agingBuckets['15+d']++;
    });

    // Distribuciones
    const by = (arr, key) => arr.reduce((acc, t) => { const k = t[key] || '—'; acc[k]=(acc[k]||0)+1; return acc; }, {});
    const byCategoria = by(tickets, 'categoria');
    const byPrioridad = by(tickets, 'prioridad');
    const byUrgencia  = by(tickets, 'urgencia');
    const byEstado    = by(tickets, 'estado');

    // Carga por técnico
    const tecnicos = UsersService.getTecnicos();
    const workload = tecnicos.map(te => ({
      tecnico: te,
      abiertos: abiertos.filter(t => t.tecnicoAsignadoId === te.id).length,
      total: tickets.filter(t => t.tecnicoAsignadoId === te.id).length,
      avgHours: (() => {
        const solved = resueltos.filter(t => t.tecnicoAsignadoId === te.id);
        if (!solved.length) return 0;
        const ms = solved.reduce((a,t)=> a + (new Date(t.fechaCierre) - new Date(t.fechaCreacion)), 0) / solved.length;
        return ms / 36e5;
      })()
    })).sort((a,b)=> b.abiertos - a.abiertos);

    // Top 5 más antiguos abiertos
    const topOld = [...abiertos]
      .sort((a,b)=> new Date(a.fechaCreacion) - new Date(b.fechaCreacion))
      .slice(0,5);

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Tickets abiertos</div><div class="kpi-value">${abiertos.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">% Escalados</div><div class="kpi-value">${tickets.length ? Math.round((escalados.length / tickets.length) * 100) : 0}%</div></div>
        <div class="kpi-card"><div class="kpi-label">Tiempo medio resolución</div><div class="kpi-value">${(avg/36e5).toFixed(1)} h</div></div>
        <div class="kpi-card"><div class="kpi-label">Mediana resolución</div><div class="kpi-value">${(median/36e5).toFixed(1)} h</div></div>
        <div class="kpi-card"><div class="kpi-label">En curso</div><div class="kpi-value">${enCurso.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">En espera</div><div class="kpi-value">${enEspera.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">Resueltos</div><div class="kpi-value">${resueltos.length}</div></div>
      </div>

      <div class="card" style="margin-bottom:1rem;">
        <div class="card-header"><h2 class="card-title">Distribución por Categoría</h2></div>
        <div class="card-body">
          ${renderSimpleTable(countToRows(byCategoria, CATEGORIAS, 'Categoría', 'Tickets'))}
        </div>
      </div>

      <div class="card" style="margin-bottom:1rem;">
        <div class="card-header"><h2 class="card-title">Estados / Prioridad / Urgencia</h2></div>
        <div class="card-body">
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label">Estados</div>${renderList(byEstado)}</div>
            <div class="kpi-card"><div class="kpi-label">Prioridad</div>${renderList(byPrioridad)}</div>
            <div class="kpi-card"><div class="kpi-label">Urgencia</div>${renderList(byUrgencia)}</div>
            <div class="kpi-card"><div class="kpi-label">Antigüedad abiertos</div>${renderList(agingBuckets)}</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:1rem;">
        <div class="card-header"><h2 class="card-title">Carga por técnico</h2></div>
        <div class="card-body">
          <div class="table-container">
            <table class="table">
              <thead><tr><th>Técnico</th><th>Abiertos</th><th>Total</th><th>Tiempo medio resuelto</th></tr></thead>
              <tbody>
              ${workload.map(w => `
                <tr>
                  <td>${escapeHtml(w.tecnico.nombre)}</td>
                  <td>${w.abiertos}</td>
                  <td>${w.total}</td>
                  <td>${w.avgHours.toFixed(1)} h</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2 class="card-title">Más antiguos abiertos (Top 5)</h2></div>
        <div class="card-body">
          ${topOld.length ? renderTicketTable(topOld, { view:true, delete:true }) : '<div class="table-empty">Sin datos</div>'}
        </div>
      </div>
    `;

    // activar botones en la tabla de topOld
    document.querySelectorAll('[data-action="view"]').forEach(btn=>{
      btn.addEventListener('click', (e)=> this.showTicketDetailModal(e.currentTarget.dataset.id));
    });
    document.querySelectorAll('[data-action="delete"]').forEach(btn=>{
      btn.addEventListener('click', (e)=> this.confirmDelete(e.currentTarget.dataset.id));
    });
  },

  // ===================== TICKETS =====================
  renderTickets(container) {
    const tickets = TicketsService.getAll();
    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h2 class="card-title">Tickets</h2></div>
        <div class="card-body">
          <div id="tickets-list">${renderTicketTable(tickets, { view:true, delete:true })}</div>
        </div>
      </div>
    `;
    document.querySelectorAll('[data-action="view"]').forEach(btn=>{
      btn.addEventListener('click', (e)=> this.showTicketDetailModal(e.currentTarget.dataset.id));
    });
    document.querySelectorAll('[data-action="delete"]').forEach(btn=>{
      btn.addEventListener('click', (e)=> this.confirmDelete(e.currentTarget.dataset.id));
    });
  },

  confirmDelete(ticketId){
    const t = TicketsService.getById(ticketId);
    if (!t) return;
    if (!confirm(`¿Eliminar definitivamente el ticket ${t.ticketNumber}?`)) return;
    try{
      TicketsService.remove(ticketId);
      NotificationService.show('Ticket eliminado', `${t.ticketNumber} eliminado`, 'success');
      this.renderTickets(document.getElementById('page-content'));
    }catch(err){
      NotificationService.show('Error', err.message, 'error');
    }
  },

  // ====== MODAL SOLO LECTURA PARA VER DETALLE (con Adjuntos) ======
  showTicketDetailModal(ticketId){
    const ticket = TicketsService.getById(ticketId);
    if(!ticket){ NotificationService.show('Error','Ticket no encontrado','error'); return; }
    const historial = TicketsService.getHistorial(ticketId);
    const tecnicos = UsersService.getTecnicos();
    const tecnicoNombre = ticket.tecnicoAsignadoId
      ? (tecnicos.find(t=>t.id===ticket.tecnicoAsignadoId)?.nombre || '-')
      : 'Sin asignar';

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
      <div class="modal-overlay" id="modal-view">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle">
          <div class="modal-header">
            <h3 class="modal-title" id="mtitle">Detalle — ${ticket.ticketNumber}</h3>
            <button class="modal-close" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="ticket-detail-grid">
              <div class="detail-item"><span class="detail-label">Estado</span>
                <span class="detail-value">${renderBadge('estado', ticket.estado)}</span>
              </div>
              <div class="detail-item"><span class="detail-label">Urgencia</span>
                <span class="detail-value">${renderBadge('urgencia', ticket.urgencia)}</span>
              </div>
              <div class="detail-item"><span class="detail-label">Prioridad (empleado)</span>
                <span class="detail-value">${ticket.prioridad ? renderBadge('prioridad', ticket.prioridad) : 'No asignada'}</span>
              </div>
              <div class="detail-item"><span class="detail-label">Técnico asignado</span>
                <span class="detail-value">${escapeHtml(tecnicoNombre)}</span>
              </div>
              <div class="detail-item"><span class="detail-label">Fecha creación</span>
                <span class="detail-value">${formatDate(ticket.fechaCreacion)}</span>
              </div>
              <div class="detail-item"><span class="detail-label">Fecha cierre</span>
                <span class="detail-value">${ticket.fechaCierre ? formatDate(ticket.fechaCierre) : 'Pendiente'}</span>
              </div>
              <div class="detail-item"><span class="detail-label">Tiempo dedicado (min)</span>
                <span class="detail-value">${ticket.tiempoDedicadoMin || 0}</span>
              </div>
              <div class="detail-item"><span class="detail-label">Categoría</span>
                <span class="detail-value">${escapeHtml(ticket.categoria || 'Otros')}</span>
              </div>
            </div>

            <hr class="section-divider"/>

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

            ${ticket.comentariosEmpleado ? `
              <div class="form-group">
                <label class="form-label">Comentarios del empleado</label>
                <div class="detail-value">${escapeHtml(ticket.comentariosEmpleado)}</div>
              </div>` : ''}

            ${ticket.acciones ? `
              <div class="form-group">
                <label class="form-label">Acciones del técnico</label>
                <div class="detail-value">${escapeHtml(ticket.acciones)}</div>
              </div>` : ''}

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
            <button class="btn btn-outline" id="btn-close">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
    const overlay = document.getElementById('modal-view');
    const close = ()=> overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#btn-close').addEventListener('click', close);
    overlay.addEventListener('click', (e)=>{ if (e.target.id === 'modal-view') close(); });
  },

  // ===================== USUARIOS (igual que tenías) =====================
  renderUsuarios(container) {
    const current = AuthService.getCurrentUser();
    if (current.rol !== 'Supervisor') {
      container.innerHTML = `
        <div class="access-denied">
          <div class="access-denied-icon">🚫</div>
          <h2 class="access-denied-title">Acceso denegado</h2>
          <p class="access-denied-message">Solo el Supervisor puede administrar usuarios.</p>
        </div>`; return;
    }

    const usuarios = UsersService.getAll()
      .filter(u => u.rol === 'Tecnico' || u.rol === 'Supervisor');

    container.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <div class="card-header"><h2 class="card-title">Crear usuario</h2></div>
        <div class="card-body">
          <form id="form-create" class="form-inline" novalidate>
            <div class="form-group"><label class="form-label required">Nombre</label><input id="u-nombre" class="form-input" required/></div>
            <div class="form-group"><label class="form-label required">Email</label><input id="u-email" class="form-input" type="email" required/></div>
            <div class="form-group">
              <label class="form-label required">Rol</label>
              <select id="u-rol" class="form-select" required>
                <option value="Tecnico">Técnico</option>
                <option value="Supervisor">Supervisor</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label required">Contraseña</label><input id="u-pass" class="form-input" type="password" required/></div>
            <div class="form-group"><button class="btn btn-success" type="submit">Crear</button></div>
          </form>
          <small class="form-help">Requisitos de contraseña: 8+ chars, mayús, minús, número y símbolo.</small>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2 class="card-title">Usuarios (Técnicos / Supervisor)</h2></div>
        <div class="card-body">
          <div class="table-container">
            <table class="table">
              <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th style="width:240px">Acciones</th></tr></thead>
              <tbody>
                ${usuarios.map(u => `
                  <tr>
                    <td>${escapeHtml(u.nombre || '-')}</td>
                    <td>${escapeHtml(u.email)}</td>
                    <td>${u.rol}</td>
                    <td>
                      <div class="btn-group">
                        <button class="btn btn-sm btn-secondary" data-action="pass" data-id="${u.id}">Cambiar contraseña</button>
                        <button class="btn btn-sm btn-danger" data-action="del" data-id="${u.id}">Eliminar</button>
                      </div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Crear usuario
    container.querySelector('#form-create').addEventListener('submit', (e)=>{
      e.preventDefault();
      const nombre = container.querySelector('#u-nombre').value.trim();
      const email  = container.querySelector('#u-email').value.trim();
      const rol    = container.querySelector('#u-rol').value;
      const pass   = container.querySelector('#u-pass').value;

      try {
        UsersService.createUser({ nombre, email, rol, password: pass });
        NotificationService.show('Usuario creado', `${email} (${rol})`, 'success');
        this.renderUsuarios(container); // recargar vista
      } catch(err) {
        NotificationService.show('Error', err.message, 'error');
      }
    });

    // Acciones por fila
    container.querySelectorAll('[data-action="pass"]').forEach(btn=>{
      btn.addEventListener('click', (e)=> {
        const userId = e.currentTarget.dataset.id;
        this.openPasswordModal(userId);
      });
    });
    container.querySelectorAll('[data-action="del"]').forEach(btn=>{
      btn.addEventListener('click', (e)=> {
        const userId = e.currentTarget.dataset.id;
        const user = UsersService.getById(userId);
        if (!confirm(`¿Eliminar a ${user.nombre} (${user.email})?`)) return;
        try {
          UsersService.deleteUser(userId);
          NotificationService.show('Usuario eliminado', user.email, 'success');
          this.renderUsuarios(container);
        } catch(err) {
          NotificationService.show('Error', err.message, 'error');
        }
      });
    });
  },

  openPasswordModal(userId) {
    const user = UsersService.getById(userId);
    const modal = `
      <div class="modal-overlay" id="modal-pass">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle">
          <div class="modal-header">
            <h3 class="modal-title" id="mtitle">Cambiar contraseña — ${escapeHtml(user.nombre)} (${user.rol})</h3>
            <button class="modal-close" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label required" for="new-pass">Nueva contraseña</label>
              <input id="new-pass" class="form-input" type="password" placeholder="Ej: Ev@Tech#42" required />
              <small class="form-help">Mín. 8 caracteres, con mayúscula, minúscula, número y símbolo.</small>
              <div id="pass-errors" class="form-error" style="display:none"></div>
            </div>
            <div class="form-group">
              <label class="form-label required" for="new-pass2">Repite la contraseña</label>
              <input id="new-pass2" class="form-input" type="password" required />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="btn-close">Cancelar</button>
            <button class="btn btn-primary" id="btn-save">Guardar</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);

    const overlay = document.getElementById('modal-pass');
    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#btn-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target.id === 'modal-pass') close(); });

    const $ = sel => overlay.querySelector(sel);
    const showErrors = (list) => {
      const el = $('#pass-errors');
      if (!list || list.length === 0) { el.style.display = 'none'; el.textContent=''; return; }
      el.style.display = 'block';
      el.textContent = '• ' + list.join(' — ');
    };

    $('#new-pass').addEventListener('input', () => {
      const pass = $('#new-pass').value;
      const { ok, errors } = UsersService.validatePassword(pass);
      showErrors(ok ? [] : errors);
    });

    $('#btn-save').addEventListener('click', () => {
      const p1 = $('#new-pass').value;
      const p2 = $('#new-pass2').value;
      if (p1 !== p2) { showErrors(['Las contraseñas no coinciden']); return; }
      try {
        UsersService.setPassword(userId, p1);
        NotificationService.show('Contraseña actualizada', `Se cambió la contraseña de ${user.email}`, 'success');
        close();
      } catch (err) {
        NotificationService.show('Error', err.message, 'error');
      }
    });
  }
};

// -------- Helpers de render para tablas/listas simples --------
function renderList(obj) {
  const rows = Object.entries(obj).sort((a,b)=> String(a[0]).localeCompare(String(b[0])));
  if (!rows.length) return '<div class="form-help">Sin datos</div>';
  return `
    <ul style="margin:0; padding-left:1rem; line-height:1.8;">
      ${rows.map(([k,v]) => `<li><strong>${escapeHtml(String(k))}:</strong> ${v}</li>`).join('')}
    </ul>`;
}
function countToRows(countObj, orderKeys, colA='Clave', colB='Valor') {
  const keys = orderKeys && orderKeys.length ? orderKeys : Object.keys(countObj);
  return { headers:[colA,colB], rows: keys.map(k => [k, countObj[k] || 0]) };
}
function renderSimpleTable(model) {
  if (!model.rows.length) return '<div class="table-empty">Sin datos</div>';
  return `
    <div class="table-container">
      <table class="table">
        <thead><tr>${model.headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>
          ${model.rows.map(r => `<tr><td>${escapeHtml(String(r[0]))}</td><td>${r[1]}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
