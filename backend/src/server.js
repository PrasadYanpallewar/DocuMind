import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { pool, testDbConnection } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import documentRoutes from './routes/documentRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'DocuMind backend is running',
  });
});

// Route handlers
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// Initialize server only after verifying database connectivity
const startServer = async () => {
  try {
    const isDbConnected = await testDbConnection();

    if (!isDbConnected) {
      console.error('CRITICAL: Server initialization aborted due to database connection failure.');
      process.exit(1);
    }

    const server = app.listen(PORT, () => {
      console.log(`DocuMind backend is running on http://localhost:${PORT}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Server startup error: Port ${PORT} is already in use.`);
      } else {
        console.error('Server startup error:', error.message);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('Unexpected server startup error:', err.message);
    process.exit(1);
  }
};

startServer();

export { app, pool };
export default app;
