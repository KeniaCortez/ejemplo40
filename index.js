import pool from "./db.js"; // Asegúrate de tener tu archivo de conexión a la base de datos
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors());
app.use(express.json());

// Clave secreta para JWT. CAMBIA ESTO POR UNA CLAVE SEGURA EN PRODUCCIÓN.
const JWT_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_super_segura";

// Middleware para proteger rutas
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null)
    return res.status(401).json({ message: "No se proporcionó token" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error("Error al verificar token:", err.message);
      return res.status(403).json({ message: "Token inválido o expirado" });
    }
    req.user = user;
    next();
  });
};

// ===================================
// Endpoints para Tablas de Dispositivos
// ===================================

app.post("/create-device-tables", async (req, res) => {
  try {
    // Tabla de Dispositivos
    await pool.query(`
            CREATE TABLE IF NOT EXISTS devices (
                id SERIAL PRIMARY KEY,
                device_name VARCHAR(100) NOT NULL,
                enroll_id VARCHAR(50) UNIQUE NOT NULL,
                status VARCHAR(20) DEFAULT 'off',
                last_value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

    // Tabla de Logs de Dispositivos
    await pool.query(`
            CREATE TABLE IF NOT EXISTS device_logs (
                id SERIAL PRIMARY KEY,
                device_id INTEGER REFERENCES devices(id),
                action VARCHAR(50) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    return res
      .status(201)
      .json({ message: "✅ Tablas de dispositivos verificadas/creadas." });
  } catch (error) {
    console.error("❌ Error creando tablas:", error.message);
    return res.status(500).json({ error: "Error al crear/verificar tablas." });
  }
});

// ===================================
// Endpoints de Lógica del Video
// ===================================

// Registro de un nuevo dispositivo
app.post("/register-device", async (req, res) => {
  const { deviceName, enrollId } = req.body;
  if (!deviceName || !enrollId) {
    return res.status(400).json({
      message: "Falta el nombre del dispositivo o el ID de registro.",
    });
  }

  try {
    const result = await pool.query(
      "INSERT INTO devices (device_name, enroll_id) VALUES ($1, $2) RETURNING device_name, enroll_id",
      [deviceName, enrollId]
    );
    return res.status(201).json({
      message: "Dispositivo registrado exitosamente.",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Error en registro:", err.message);
    if (err.code === "23505") {
      return res.status(409).json({ message: "El Enroll ID ya existe." });
    }
    return res
      .status(500)
      .json({ message: "Error al registrar el dispositivo." });
  }
});

// Login de un dispositivo
app.post("/login-device", async (req, res) => {
  const { enrollId } = req.body;
  if (!enrollId) {
    return res.status(400).json({ message: "Se requiere el Enroll ID." });
  }

  try {
    const result = await pool.query(
      "SELECT id, device_name, enroll_id FROM devices WHERE enroll_id = $1",
      [enrollId]
    );
    const device = result.rows[0];

    if (!device) {
      return res.status(404).json({ message: "Enroll ID no encontrado." });
    }

    // Generar un token para el dispositivo autenticado
    const token = jwt.sign(
      { id: device.id, enrollId: device.enroll_id },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Login exitoso.",
      deviceName: device.device_name,
      enrollId: device.enroll_id,
      token: token,
    });
  } catch (err) {
    console.error("Error en login:", err.message);
    return res.status(500).json({ message: "Error al iniciar sesión." });
  }
});

// Obtener estado del dispositivo (Ruta protegida)
app.get("/device-status", authenticateToken, async (req, res) => {
  const { id } = req.user;
  try {
    const result = await pool.query(
      "SELECT status, last_value FROM devices WHERE id = $1",
      [id]
    );
    if (result.rows.length > 0) {
      return res.json({
        status: result.rows[0].status,
        lastValue: result.rows[0].last_value,
      });
    }
    return res.status(404).json({ message: "Dispositivo no encontrado." });
  } catch (err) {
    console.error("Error al obtener estado:", err.message);
    return res.status(500).json({ message: "Error al obtener el estado." });
  }
});

// Encender dispositivo (Ruta protegida)
app.post("/turn-on-device", authenticateToken, async (req, res) => {
  const { id } = req.user;
  try {
    await pool.query(
      "UPDATE devices SET status = 'on', last_value = $1 WHERE id = $2",
      [new Date().toISOString(), id]
    );
    await pool.query(
      "INSERT INTO device_logs (device_id, action) VALUES ($1, 'ON')",
      [id]
    );
    return res.json({ message: "Dispositivo encendido." });
  } catch (err) {
    console.error("Error al encender:", err.message);
    return res
      .status(500)
      .json({ message: "Error al encender el dispositivo." });
  }
});

// Apagar dispositivo (Ruta protegida)
app.post("/turn-off-device", authenticateToken, async (req, res) => {
  const { id } = req.user;
  try {
    await pool.query(
      "UPDATE devices SET status = 'off', last_value = $1 WHERE id = $2",
      [new Date().toISOString(), id]
    );
    await pool.query(
      "INSERT INTO device_logs (device_id, action) VALUES ($1, 'OFF')",
      [id]
    );
    return res.json({ message: "Dispositivo apagado." });
  } catch (err) {
    console.error("Error al apagar:", err.message);
    return res.status(500).json({ message: "Error al apagar el dispositivo." });
  }
});

// Obtener logs del dispositivo (Ruta protegida)
app.get("/device", authenticateToken, async (req, res) => {
  const { id } = req.user;
  try {
    const result = await pool.query(
      "SELECT action, timestamp FROM device_logs WHERE device_id = $1 ORDER BY timestamp DESC LIMIT 10",
      [id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener logs:", err.message);
    return res.status(500).json({ message: "Error al obtener los logs." });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
