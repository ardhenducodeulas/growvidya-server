const mysql = require('mysql2/promise');
const config = require('./app.config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[Database] Successfully connected to MySQL database: '${config.db.database}'`);
    connection.release();
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MySQL database '${config.db.database}':`, error.message);
  }
}

module.exports = {
  pool,
  testConnection,
};
