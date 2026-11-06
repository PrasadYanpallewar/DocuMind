import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  uploadMiddleware,
  uploadDocument,
  chatWithDocument,
  getDocumentChatHistory,
  getUserDocuments,
  deleteDocument,
} from '../controllers/documentController.js';

const router = Router();

// Protected User Documents List Route
router.get('/', authMiddleware, getUserDocuments);

// Protected Document Upload Route (PDF, DOCX, TXT)
router.post('/upload', authMiddleware, uploadMiddleware, uploadDocument);

// Protected Delete Document Route
router.delete('/:id', authMiddleware, deleteDocument);

// Protected Document Chat (RAG Q&A) Routes
router.post('/:id/chat', authMiddleware, chatWithDocument);
router.get('/:id/chat', authMiddleware, getDocumentChatHistory);
router.get('/:id/history', authMiddleware, getDocumentChatHistory);

export default router;
