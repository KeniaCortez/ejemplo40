import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString:
    "postgresql://root:XVXd2Zue7nFJrQGTy6WC1CxufMCd2nJa@dpg-d2b4auvdiees73ed54h0-a.oregon-postgres.render.com/nuevo_6ueg",
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
