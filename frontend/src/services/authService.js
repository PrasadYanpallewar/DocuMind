import api from './api';

export const authService = {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register({ name, email, password }) {
    const response = await api.post('/api/auth/register', { name, email, password });
    return response.data;
  },

  /**
   * Login user
   * POST /api/auth/login
   */
  async login({ email, password }) {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },

  /**
   * Fetch currently authenticated user profile
   * GET /api/auth/me
   */
  async getCurrentUser() {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

export default authService;
