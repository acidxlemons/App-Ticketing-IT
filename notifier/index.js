import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import "dotenv/config";

const app = express();

// CORS
const allowed = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin)) cb(null, true);
    else cb(new Error("CORS"), false);
  }
}));
app.use(express.json());

// ---------- Email (Office 365) ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

app.post("/notify/email", async (req, res) => {
  const { to, subject, html } = req.body || {};
  if (!to || !subject || !html) return res.status(400).json({ ok: false, error: "Faltan to, subject, html" });
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html
    });
    console.log("✅ Email enviado:", info.messageId, "→", to);
    res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error("❌ Error enviando email:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- Upload de ficheros ----------
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// límites (ajústalos a tu gusto)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^\w\-]+/g, "_");
    cb(null, `${uuidv4()}_${base}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    // Permitir imágenes y documentos comunes
    const ok = [
      "image/png", "image/jpeg", "image/gif", "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ].includes(file.mimetype);
    if (!ok) return cb(new Error("Tipo de archivo no permitido"));
    cb(null, true);
  }
});

// Endpoint para subir varios ficheros (campo 'files')
app.post("/upload", upload.array("files", 10), (req, res) => {
  const files = (req.files || []).map(f => ({
    id: uuidv4(),
    filename: f.filename,
    originalname: f.originalname,
    size: f.size,
    mimetype: f.mimetype,
    url: `/uploads/${f.filename}`,
    uploadedAt: new Date().toISOString()
  }));
  console.log(`📁 ${files.length} archivo(s) subido(s)`);
  res.json({ ok: true, files });
});

// Servir estáticos
app.use("/uploads", express.static(UPLOAD_DIR));

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`📨 Notifier corriendo en http://10.0.0.90:${PORT}`);
  console.log(`📁 Archivos servidos en http://10.0.0.90:${PORT}/uploads/...`);
});
