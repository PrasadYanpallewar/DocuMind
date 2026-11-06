import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { pool } from '../config/db.js';

const router = Router();

// Authentication Routes
router.post('/register', register);
router.post('/login', login);

/**
 * Get current authenticated user details
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const query = `
      SELECT id, name, email, created_at
      FROM users
      WHERE id = $1;
    `;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        user: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'An internal server error occurred while retrieving user details.',
    });
  }
});

export default router;
