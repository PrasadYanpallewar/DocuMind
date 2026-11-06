import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

// Read JWT secret from environment variables or fallback for local dev
const JWT_SECRET = process.env.JWT_SECRET || 'documind_jwt_secret_dev_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate presence of required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Name, email, and password are required fields.',
      });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Validate name
    if (trimmedName.length < 2) {
      return res.status(400).json({
        status: 'error',
        message: 'Name must be at least 2 characters long.',
      });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email address.',
      });
    }

    // Validate password complexity
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Hash the password securely
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user into PostgreSQL using parameterized query
    const insertQuery = `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at;
    `;
    const values = [trimmedName, normalizedEmail, passwordHash];

    const result = await pool.query(insertQuery, values);
    const newUser = result.rows[0];

    // Generate authentication token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      status: 'success',
      message: 'User registered successfully.',
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          created_at: newUser.created_at,
        },
        token,
      },
    });
  } catch (error) {
    // PostgreSQL error code 23505 = unique_violation (duplicate email)
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message: 'An account with this email address already exists.',
      });
    }

    console.error('Registration error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'An internal server error occurred while processing registration.',
    });
  }
};

/**
 * Authenticate existing user and issue JWT
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate presence of credentials
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user by email using parameterized query
    const findUserQuery = `
      SELECT id, name, email, password_hash, created_at
      FROM users
      WHERE email = $1;
    `;
    const result = await pool.query(findUserQuery, [normalizedEmail]);

    if (result.rows.length === 0) {
      // Use uniform error message to prevent user enumeration
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
      });
    }

    const user = result.rows[0];

    // Compare provided password with stored password hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Return safe user payload (never include password_hash)
    return res.status(200).json({
      status: 'success',
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'An internal server error occurred while processing login.',
    });
  }
};
