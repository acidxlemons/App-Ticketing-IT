/**
 * Servicio de notificaciones
 * - Envía correos reales a través del notifier backend (Express + Nodemailer)
 * - Envía aviso a los TÉCNICOS cuando se crea un ticket
 * - Envía aviso al EMPLEADO en creación, cambio de estado y cierre
 * - El SUPERVISOR no recibe correos
 *
 * Requisitos:
 *  - Notifier corriendo en: http://10.0.0.90:3001/notify/email
 *  - CORS del notifier permite http://10.0.0.90:5173 y/o http://localhost:5173
 */

const NOTIFIER_URL = 'http://10.0.0.90:3001/notify/email';

const TECH_EMAILS = [
  'icabanas@europavia.es',
  'amballesteros@europavia.es'
];

function toEmailList(to) {
  if (!to) return '';
  if (Array.isArray(to)) return to.filter(Boolean).join(',');
  return String(to);
}

export const NotificationService = {
  /**
   * Envío de email REAL vía backend notifier
   * - Acepta to como string o array
   * - Convierte body a HTML simple
   */
  async sendEmail(to, subject, body) {
    const recipients = toEmailList(to);
    const html = String(body || '').replace(/\n/g, '<br>');

    try {
      const res = await fetch(NOTIFIER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: recipients, subject, html })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Notifier respondió ${res.status}: ${txt}`);
      }
      // Éxito: opcionalmente podrías hacer console.log aquí
    } catch (err) {
      console.error('❌ Error enviando email:', err);
      // No rompemos el flujo; informamos con un toast visible
      this.show('Error al enviar correo', 'No se pudo enviar la notificación por email. Revisa el notifier.', 'error');
    }
  },

  /**
   * Notificación visual (toast)
   */
  show(title, message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const id = 'notif-' + Date.now();
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.id = id;
    notification.setAttribute('role', 'alert');

    notification.innerHTML = `
      <div class="notification-icon"></div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" aria-label="Cerrar notificación">×</button>
    `;

    container.appendChild(notification);

    notification.querySelector('.notification-close').addEventListener('click', () => {
      this.close(id);
    });

    setTimeout(() => this.close(id), 5000);
  },

  close(id) {
    const n = document.getElementById(id);
    if (!n) return;
    n.style.opacity = '0';
    n.style.transform = 'translateX(100%)';
    setTimeout(() => n.remove(), 300);
  },

  // ====== MÉTODOS ESPECÍFICOS ======

  /**
   * 1) Ticket creado
   *  - Mail a empleado (confirmación)
   *  - Mail a TODOS los técnicos (nuevo ticket)
   *  - Toast de éxito
   */
  async notifyTicketCreated(ticket) {
    // Empleado
    await this.sendEmail(
      ticket.correoEmpleado,
      `Ticket ${ticket.ticketNumber} creado`,
      `Tu ticket "${ticket.titulo}" ha sido creado.\n` +
      `Prioridad (empleado): ${ticket.prioridad}\n` +
      `Categoría: ${ticket.categoria}\n` +
      `Número: ${ticket.ticketNumber}`
    );

    // Técnicos (broadcast)
    await this.sendEmail(
      TECH_EMAILS,
      `Nueva incidencia: ${ticket.ticketNumber}`,
      `Se ha creado una nueva incidencia.\n` +
      `Título: ${ticket.titulo}\n` +
      `Prioridad (empleado): ${ticket.prioridad}\n` +
      `Categoría: ${ticket.categoria}\n` +
      `Enlace interno: abrir la app y buscar ${ticket.ticketNumber}`
    );

    this.show('Ticket creado', `Se creó ${ticket.ticketNumber}`, 'success');
  },

  /**
   * 2) Cambio de estado (al empleado)
   */
  async notifyTicketStateChange(ticket) {
    await this.sendEmail(
      ticket.correoEmpleado,
      `Actualización de estado — ${ticket.ticketNumber}`,
      `Tu ticket "${ticket.titulo}" ahora está en estado: ${ticket.estado}.`
    );
    this.show('Cambio de estado', `Ticket ${ticket.ticketNumber}: ${ticket.estado}`, 'info');
  },

  /**
   * 3) Solicitud de información (del técnico al empleado)
   */
  async notifyInformationRequest(ticket, mensaje) {
    await this.sendEmail(
      ticket.correoEmpleado,
      `Solicitud de información — ${ticket.ticketNumber}`,
      `El técnico necesita más información sobre "${ticket.titulo}":\n${mensaje}\n` +
      `Enlace interno: abrir la app y buscar ${ticket.ticketNumber}`
    );
    this.show('Información solicitada', `Ticket ${ticket.ticketNumber}: se pidió información al empleado`, 'warning');
  },

  /**
   * 4) Cierre de ticket (al empleado)
   */
  async notifyTicketResolved(ticket) {
    await this.sendEmail(
      ticket.correoEmpleado,
      `Ticket ${ticket.ticketNumber} resuelto`,
      `Tu ticket "${ticket.titulo}" ha sido resuelto.\n` +
      `Tiempo total invertido: ${ticket.tiempoDedicadoMin || 0} minutos.\n` +
      (ticket.fechaCierre ? `Cerrado el: ${new Date(ticket.fechaCierre).toLocaleString('es-ES')}` : '')
    );
    this.show('Ticket resuelto', `Tu ticket ${ticket.ticketNumber} ha sido resuelto.`, 'success');
  }
};
