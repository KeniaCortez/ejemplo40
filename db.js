import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString:
    "postgresql://postgreskenia_user:WW8sISbignSDrKhnlQygqFrlJG3dSPYx@dpg-d0vknnndiees73d0mvl0-a.oregon-postgres.render.com/postgreskenia",
  ssl: {
    rejectUnauthorized: false,
  },
});

export default pool;
/*
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log("Connected to the database successfully");
    client.release();
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
}

testConnection();
*/
