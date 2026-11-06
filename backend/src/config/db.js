import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure environment variables are loaded regardless of current working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const { Pool } = pg;

// PostgreSQL Connection Pool Configuration
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'documind',
  user: process.env.DB_USER || 'documind_user',
  password: process.env.DB_PASSWORD,
});

// Pool error handling for idle clients
pool.on('error', (err) => {
  const errMsg = err.message || (err.errors && err.errors[0]?.message) || err.code || String(err);
  console.error('Unexpected error on idle PostgreSQL client:', errMsg);
});

/**
 * Tests database connectivity by acquiring a client from the pool
 * and querying current connection metadata.
 *
 * @returns {Promise<boolean>} True if connection succeeded, false otherwise.
 */
export const testDbConnection = async () => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT current_database(), current_user, NOW() as current_time');
    const { current_database, current_user, current_time } = result.rows[0];

    console.log('✓ PostgreSQL connected successfully!');
    console.log(`  Database : ${current_database}`);
    console.log(`  User     : ${current_user}`);
    console.log(`  Timestamp: ${current_time}`);
    return true;
  } catch (error) {
    const errorDetail =
      error.message ||
      (error.errors && error.errors[0]?.message) ||
      error.code ||
      String(error);

    console.error('✗ Failed to connect to PostgreSQL database:');
    console.error(`  Error: ${errorDetail}`);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};

export default pool;
