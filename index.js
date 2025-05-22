const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/temperature", (req, res) => {
  res.json({ valor: "10°C", timestamp: new Date().toISOString() });
});

app.get("/velocidad", (req, res) => {
  res.json({ nomnre: "kenia ", apellido: "cortez" });
});

app.get("/Tiempo", (req, res) => {
  res.json({ Hora: "2:00pm", ciudad: "gomez palacio" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
