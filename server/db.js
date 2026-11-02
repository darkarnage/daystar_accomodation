require('dotenv').config();
const mysql = require('mysql2/promise');

// One shared pool. All queries must use ? placeholders, never string-built SQL.
module.exports = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
});
