import pool from "./db.js";
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.post("/create-device-tables", async (req, res) => {
  try {
    // --- device_logs ---
    const checkLogs = await pool.query(
      "SELECT to_regclass($1)::text AS exists",
      ["public.device_logs"]
    );

    if (!checkLogs.rows[0].exists) {
      await pool.query(`
        CREATE TABLE device_logs (
          id SERIAL PRIMARY KEY,
          action VARCHAR(50) NOT NULL,
          "user" TEXT NOT NULL,
          enroll_id TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // --- relay_status ---
    const checkRelay = await pool.query(
      "SELECT to_regclass($1)::text AS exists",
      ["public.relay_status"]
    );

    if (!checkRelay.rows[0].exists) {
      // Row existence will represent ON/OFF (id=1 present => ON)
      await pool.query(`
        CREATE TABLE relay_status (
          id INTEGER PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    return res.status(201).json({
      message: "✅ Tablas verificadas/creadas",
      tables: {
        device_logs: checkLogs.rows[0].exists ? "ya existía" : "creada",
        relay_status: checkRelay.rows[0].exists ? "ya existía" : "creada",
      },
    });
  } catch (error) {
    console.error("❌ Error creando tablas:", error.message);
    return res.status(500).json({ error: "Error al crear/verificar tablas" });
  }
});

app.post("/register-device", async (req, res) => {
  const { device_name, enroll_id, status } = req.body;

  if (!device_name || !enroll_id || !status) {
    return res.status(400).json({
      error:
        "Faltan campos requeridos: device_name, enroll_id y status son obligatorios.",
    });
  }

  try {
    // 1. Intenta actualizar un registro existente, usando "enroll_id" como clave única
    const updateResult = await pool.query(
      `
      UPDATE devices
      SET device_name = $2, status = $3, created_at = CURRENT_TIMESTAMP
      WHERE enroll_id = $1
      RETURNING *;
      `,
      [enroll_id, device_name, status]
    );

    // 2. Si no se actualizó ningún registro, significa que no existe. Entonces, inserta uno nuevo.
    if (updateResult.rowCount === 0) {
      const insertResult = await pool.query(
        `
        INSERT INTO devices (device_name, enroll_id, status)
        VALUES ($1, $2, $3)
        RETURNING *;
        `,
        [device_name, enroll_id, status]
      );
      return res.status(201).json({
        message: "✅ Dispositivo insertado exitosamente",
        device: insertResult.rows[0],
      });
    }

    // Si se actualizó, devuelve la respuesta de la actualización
    return res.status(200).json({
      message: "✅ Dispositivo actualizado exitosamente",
      device: updateResult.rows[0],
    });
  } catch (error) {
    console.error("❌ Error al registrar dispositivo:", error.message);
    return res.status(500).json({
      error: "Error interno del servidor al registrar el dispositivo.",
    });
  }
});

app.delete("/deletetable", async (req, res) => {
  try {
    const tableName = "data";

    const checkTable = await pool.query("SELECT to_regclass($1) AS exists", [
      tableName,
    ]);

    if (checkTable.rows[0].exists) {
      await pool.query(`
        DROP TABLE ${tableName};
      `);

      return res
        .status(201)
        .json({ message: "✅ Tabla eliminada exitosamente" });
    } else {
      return res.status(200).json({ message: "ℹ La tabla no existe" });
    }
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

app.post("/turn-on", async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO relay_status (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `);
    return res.json({ status: { isOn: true } });
  } catch (err) {
    console.error("Error /turn-on:", err.message);
    return res.status(500).json({ error: "No se pudo encender" });
  }
});

app.post("/turn-off", async (req, res) => {
  try {
    await pool.query("DELETE FROM relay_status WHERE id = 1");
    return res.json({ status: { isOn: false } });
  } catch (err) {
    console.error("Error /turn-off:", err.message);
    return res.status(500).json({ error: "No se pudo apagar" });
  }
});

app.get("/status", async (req, res) => {
  try {
    const result = await pool.query("SELECT 1 FROM relay_status WHERE id = 1");
    const isOn = result.rowCount > 0;
    return res.json({ status: { isOn } });
  } catch (err) {
    console.error("Error /status:", err.message);
    return res.status(500).json({ error: "No se pudo leer estado" });
  }
});

app.get("/get-devices", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM devices");
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Error al obtener dispositivos:", err.message);
    return res.status(500).json({ error: "Imposible regresar los datos" });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
/*app.post("/create-table", async (req, res) => {
  try {
    const tableName = "data";

    const checkTable = await pool.query("SELECT to_regclass($1) AS exists", [
      tableName,
    ]);

    if (!checkTable.rows[0].exists) {
      await pool.query(`
        CREATE TABLE ${tableName} (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(100) NOT NULL,
          matricula VARCHAR(50) NOT NULL,
          value TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      return res.status(201).json({ message: "✅ Tabla creada exitosamente" });
    } else {
      return res.status(200).json({ message: "ℹ La tabla ya existe" });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
}); */

app.post("/savedata", async (req, res) => {
  // La ruta debe coincidir con Postman: "/savedata"
  const { value, nombre, matricula } = req.body;

  // Validación para todos los campos requeridos
  if (!value || !nombre || !matricula) {
    return res.status(400).json({
      error: "Todos los campos (value, nombre, matricula) son requeridos",
    });
  }

  const tableName = "data"; // Nombre de la tabla
  try {
    const result = await pool.query(
      `INSERT INTO ${tableName} (value, nombre, matricula) VALUES ($1, $2, $3) RETURNING *`,
      [value, nombre, matricula]
    );

    return res.status(201).json({
      message: "✅ Datos guardados exitosamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    return res.status(500).json({ error: "Error al guardar los datos" });
  }
});
S
app.get("/get-data", async (req, res) => {
  const tableName = "data";

  try {
    const result = await pool.query(`SELECT * FROM ${tableName}`);
    return res.json(result.rows);
  } catch {
    return res.status(500).json({ error: "Imposible regresar los datos" });
  }
});
