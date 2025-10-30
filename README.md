# 🎫 Sistema de Tickets - Plataforma de Gestión Interna

Este proyecto es una **aplicación web completa para la gestión de tickets de soporte técnico**, desarrollada como demostración funcional adaptable a cualquier empresa.  
Su estructura, lógica y componentes fueron inspirados por un entorno real de trabajo (en este caso, **Europavia**), aunque **puede implementarse en cualquier organización o pyme** sin cambios significativos.

---

## 🧩 Descripción General

El sistema está dividido en dos componentes principales:

1. **Frontend (cliente web)**  
   - Desarrollado en **HTML5, CSS3 y JavaScript modular (ESM)**.  
   - Se ejecuta completamente en el navegador.  
   - Almacena los datos de usuarios y tickets de forma persistente usando **IndexedDB**.  
   - Gestiona diferentes roles de acceso (Empleado, Técnico, Supervisor).

2. **Backend (notifier)**  
   - Servidor **Node.js + Express** dedicado exclusivamente a **enviar notificaciones por correo electrónico**.  
   - Usa **Nodemailer** con autenticación SMTP (Microsoft 365 o cualquier otro proveedor).  
   - Incluye control de CORS para permitir peticiones desde el frontend.

El sistema es **autosuficiente y portable**: no depende de bases de datos externas ni requiere despliegue en la nube, lo que lo convierte en una herramienta ideal para entornos de prueba, formación, demostración o empresas pequeñas.

---

## ⚙️ Características Principales

### 🧑‍💼 Empleados
- Acceso mediante nombre, apellidos y correo electrónico.  
- Creación de tickets con los siguientes campos:
  - **Título del problema**
  - **Descripción detallada**
  - **Nivel de urgencia**
  - **Archivos adjuntos (opcional)**
- Seguimiento del estado de los tickets en tiempo real.
- Recepción de correos automáticos cuando:
  - Se crea un ticket.
  - Se cierra o resuelve un ticket.

---

### 🧑‍🔧 Técnicos
- Acceso mediante credenciales registradas (email y contraseña).  
- Visualización de todos los tickets pendientes o asignados.  
- Posibilidad de:
  - Cambiar estado del ticket (*En curso*, *Resuelto*, *Escalado*).  
  - Añadir comentarios o notas internas.  
- Recepción de notificaciones por correo cuando se les asigna un nuevo ticket.

---

### 🧑‍💼 Supervisores
- Acceso completo a todas las funcionalidades del sistema.  
- Creación, modificación y eliminación de usuarios técnicos o supervisores.  
- Revisión global de tickets con filtros y estadísticas básicas.  
- Control del ciclo de vida de los tickets y gestión de roles.  
- Herramientas de administración local de datos.

---

## 🧠 Arquitectura Técnica

El sistema se compone de módulos independientes y organizados:

```
Ticketing/
│
├── assets/                    → Imágenes y logotipos corporativos
│   ├── logosinfondo.png
│   └── E-sin-fondo.png
│
├── notifier/                  → Servidor Node.js (notificaciones por correo)
│   ├── index.js               → Servidor Express principal
│   ├── package.json           → Dependencias (express, nodemailer, cors)
│   ├── .env                   → Configuración SMTP y CORS
│   └── uploads/               → Archivos adjuntos recibidos
│
├── src/
│   ├── app.js                 → Inicialización del frontend
│   ├── router.js              → Enrutamiento por rol (Empleado/Técnico/Supervisor)
│   ├── auth.js                → Gestión de sesión, login y logout
│   ├── store/db.js            → Implementación de IndexedDB
│   ├── services/
│   │   └── users.js           → CRUD de usuarios, validaciones y contraseñas
│   └── pages/
│       ├── empleado/          → Interfaz y lógica del empleado
│       ├── tecnico/           → Interfaz del técnico
│       └── supervisor/        → Interfaz del supervisor
│
├── index.html                 → Página principal
└── README.md                  → Este documento
```

---

## 🧰 Tecnologías Utilizadas

| Categoría | Tecnologías |
|------------|-------------|
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) |
| **Backend** | Node.js, Express, Nodemailer |
| **Base de datos local** | IndexedDB |
| **Persistencia de sesión** | localStorage |
| **Servidor de desarrollo** | `http-server` (frontend), `Express` (backend) |
| **Sistema de correos** | Microsoft 365 SMTP (puede reemplazarse por Gmail, SendGrid, etc.) |

---

## 📧 Configuración de Notificaciones por Correo

El servicio de correo (`notifier`) usa **Nodemailer** y se configura mediante un archivo `.env`:

```ini
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=tu-buzon@tudominio.com
SMTP_PASS=contraseña_o_app_password
SMTP_FROM=tu-buzon@tudominio.com
PORT=3001
CORS_ALLOWED_ORIGINS=http://10.0.0.90:5173,http://localhost:5173
```

> ⚠️ Si el buzón tiene autenticación multifactor (MFA), es obligatorio generar una **App Password** en Microsoft 365.  
> Si usas otro proveedor (p. ej., Gmail), cambia el `SMTP_HOST` y el `PORT` según la documentación del proveedor.

---

## 💾 Almacenamiento y Persistencia

El sistema **no depende de un servidor de base de datos**.  
Toda la información se almacena de forma local y persistente en el navegador mediante **IndexedDB**, lo que permite:

- Mantener tickets y usuarios incluso si el servidor se reinicia.  
- Funcionar parcialmente sin conexión (modo offline).  
- Facilitar copias de seguridad mediante exportación manual.

> Esto lo convierte en un sistema ligero, ideal para entornos cerrados o demostraciones donde no se requiera backend persistente.

---

## ⚙️ Cómo Ejecutar el Proyecto

### 1️⃣ Instalar dependencias del backend
Desde CMD (no PowerShell):

```bash
cd C:\Users\amballesteros\Desktop\Ticketing\notifier
npm install
```

### 2️⃣ Iniciar el servidor de notificaciones
```bash
npm start
```

Deberías ver:
```
📨 Notifier corriendo en http://10.0.0.90:3001
📁 Archivos servidos en http://10.0.0.90:3001/uploads/...
```

---

### 3️⃣ Iniciar el frontend
En otra terminal:

```bash
cd C:\Users\amballesteros\Desktop\Ticketing
npx http-server -p 5173 -c-1
```

Luego abre en tu navegador:  
👉 [http://10.0.0.90:5173](http://10.0.0.90:5173)

---

## 🔒 Control de Accesos y Roles

| Rol | Descripción | Permisos |
|------|--------------|----------|
| **Empleado** | Crea y consulta sus propios tickets | Crear / Leer |
| **Técnico** | Gestiona tickets asignados | Leer / Actualizar |
| **Supervisor** | Administra el sistema completo | CRUD completo |

Cada usuario se guarda con un `rol` y un `email` identificador único.  
El sistema asigna automáticamente un ID estable para empleados basándose en su correo.

---

## 🔐 Validación de Contraseñas

Las contraseñas se validan antes de almacenarse con los siguientes criterios:

- Mínimo 8 caracteres.  
- Al menos una letra mayúscula y una minúscula.  
- Al menos un número.  
- Al menos un símbolo especial.

Si no cumple, el sistema muestra un mensaje con los errores específicos.

---

## 🧾 Notificaciones Automáticas

Los correos se envían mediante el endpoint `/notify/email`:

```json
{
  "to": "usuario@tudominio.com",
  "subject": "Nuevo ticket asignado",
  "html": "<p>Se te ha asignado el ticket #123</p>"
}
```

Ejemplo de prueba manual con `curl`:
```bash
curl -X POST http://10.0.0.90:3001/notify/email   -H "Content-Type: application/json"   -d '{"to":"empleado@tudominio.com","subject":"Prueba","html":"<p>Funciona!</p>"}'
```

---

## 🧰 Mantenimiento del Sistema

- Para reiniciar el backend → `Ctrl + C` y luego `npm start`.  
- Los archivos adjuntos se guardan en `notifier/uploads/`.  
- Los logs del servidor muestran errores de conexión o autenticación SMTP.  
- Se pueden añadir nuevos roles editando `users.js` y `router.js`.  
- Todos los datos locales (tickets, usuarios) pueden limpiarse desde el navegador o mediante consola (`indexedDB.deleteDatabase('tickets')`).

---

## 💡 Posibles Mejoras Futuras

- Implementar **base de datos real** (PostgreSQL, MongoDB o DynamoDB).  
- Integrar **autenticación corporativa (Azure AD o Google Workspace)**.  
- Añadir **exportación a PDF y Excel**.  
- Crear **dashboard visual con gráficas** en tiempo real.  
- Añadir **notificaciones instantáneas (Teams, Slack o Telegram)**.  
- Implementar un **modo multitenant** para varias empresas.

---

## 🧑‍💻 Autor

**A. Ballesteros**  
Ingeniero de Telecomunicaciones | IT and AI DevOps  
Proyecto personal desarrollado como demostración profesional adaptable a cualquier empresa o institución.  
📅 Año: 2025

> *Este sistema representa una solución integral, escalable y pedagógica para la gestión de tickets internos, que combina la simplicidad del almacenamiento local con la robustez de un backend modular en Node.js.*
