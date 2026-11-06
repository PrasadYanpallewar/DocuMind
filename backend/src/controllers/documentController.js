import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { pool } from '../config/db.js';
import aiService from '../services/aiService.js';

// Standard UUID format validation regex (matches any 32-hex UUID with hyphens)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (id) => typeof id === 'string' && UUID_REGEX.test(id.trim());

// Resolve uploads directory relative to this controller file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

// Ensure destination directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Maximum upload file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed document extensions
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);

// Configure disk storage with collision-resistant unique naming preserving original extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${sanitizedBase}-${uniqueSuffix}${ext}`);
  },
});

// Preliminary validation on file extension and MIME type
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      new Error('Invalid file type. Only PDF (.pdf), Word (.docx), and Text (.txt) files are supported.'),
      false
    );
  }

  cb(null, true);
};

// Initialize multer instance
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/**
 * Safely removes a list of uploaded files from disk.
 *
 * @param {Array<Object>} files - Array of Multer file objects.
 */
const cleanupFiles = async (files = []) => {
  for (const file of files) {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        await fs.promises.unlink(file.path);
      } catch (err) {
        console.error('Failed to cleanup file:', err.message);
      }
    }
  }
};

/**
 * Validates that the uploaded file content actually begins with the '%PDF-' magic header.
 *
 * @param {string} filePath - Absolute path to the file.
 * @returns {Promise<boolean>} True if file begins with '%PDF-', false otherwise.
 */
export const verifyPdfSignature = async (filePath) => {
  let fileHandle;
  try {
    fileHandle = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(5);
    const { bytesRead } = await fileHandle.read(buffer, 0, 5, 0);

    if (bytesRead < 5) {
      return false;
    }

    return buffer.toString('ascii') === '%PDF-';
  } catch (err) {
    console.error('Error verifying PDF magic signature:', err.message);
    return false;
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
};

/**
 * Validates that a DOCX file is a valid ZIP container (starts with PK\x03\x04).
 */
export const verifyDocxSignature = async (filePath) => {
  let fileHandle;
  try {
    fileHandle = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(4);
    const { bytesRead } = await fileHandle.read(buffer, 0, 4, 0);

    if (bytesRead < 4) {
      return false;
    }

    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    );
  } catch (err) {
    console.error('Error verifying DOCX signature:', err.message);
    return false;
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
};

/**
 * Validates that a TXT file contains readable text and not binary / executable payload.
 */
export const verifyTxtContent = async (filePath) => {
  let fileHandle;
  try {
    fileHandle = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(2048);
    const { bytesRead } = await fileHandle.read(buffer, 0, 2048, 0);

    if (bytesRead === 0) {
      return false;
    }

    // Check for null bytes (0x00) which indicate binary files
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0x00) {
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('Error verifying TXT content:', err.message);
    return false;
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
};

/**
 * Verifies document file signature or content based on extension.
 */
export const verifyDocumentSignature = async (filePath, ext) => {
  const normalizedExt = (ext || '').toLowerCase();
  if (normalizedExt === '.pdf') {
    return verifyPdfSignature(filePath);
  }
  if (normalizedExt === '.docx') {
    return verifyDocxSignature(filePath);
  }
  if (normalizedExt === '.txt') {
    return verifyTxtContent(filePath);
  }
  return false;
};

/**
 * Middleware handling file extraction with strict single-file enforcement:
 * - Supports either 'file' or 'document' field name.
 * - Rejects requests containing both fields and cleans up any saved files.
 * - Handles size limits (10 MB) and Multer errors safely.
 */
export const uploadMiddleware = (req, res, next) => {
  const uploadHandler = upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'document', maxCount: 1 },
  ]);

  uploadHandler(req, res, async (err) => {
    // Collect all uploaded files that Multer may have written to disk
    const allUploadedFiles = [
      ...(req.files?.file || []),
      ...(req.files?.document || []),
    ];

    if (err instanceof multer.MulterError) {
      await cleanupFiles(allUploadedFiles);

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          status: 'error',
          message: 'File size exceeds maximum allowed limit of 10 MB.',
        });
      }
      return res.status(400).json({
        status: 'error',
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      await cleanupFiles(allUploadedFiles);
      return res.status(400).json({
        status: 'error',
        message: err.message || 'File upload failed.',
      });
    }

    const hasFile = Array.isArray(req.files?.file) && req.files.file.length > 0;
    const hasDocument = Array.isArray(req.files?.document) && req.files.document.length > 0;

    // Reject requests providing multiple files across both supported fields
    if (hasFile && hasDocument) {
      await cleanupFiles(allUploadedFiles);
      return res.status(400).json({
        status: 'error',
        message: 'Multiple files detected. Please upload only one file using either "file" or "document", not both.',
      });
    }

    // Normalize single uploaded file to req.file
    req.file = (req.files?.file?.[0] || req.files?.document?.[0]) ?? null;

    next();
  });
};

/**
 * Handle document upload, deep signature verification, and metadata insertion
 * POST /api/documents/upload
 */
export const uploadDocument = async (req, res) => {
  // 1. Validate file presence
  if (!req.file) {
    return res.status(400).json({
      status: 'error',
      message: 'No file was uploaded. Please upload a file with field name "file" or "document".',
    });
  }

  const { path: storagePath, originalname, size, mimetype } = req.file;
  const userId = req.user?.userId;
  const ext = path.extname(originalname).toLowerCase();

  // 2. Validate user authentication
  if (!userId) {
    if (fs.existsSync(storagePath)) {
      await fs.promises.unlink(storagePath).catch(() => {});
    }
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized. User authentication required.',
    });
  }

  // 3. Deep signature / content verification based on file extension
  const isValid = await verifyDocumentSignature(storagePath, ext);
  if (!isValid) {
    if (fs.existsSync(storagePath)) {
      try {
        await fs.promises.unlink(storagePath);
      } catch (cleanupErr) {
        console.error('Failed to cleanup invalid file after signature failure:', cleanupErr.message);
      }
    }
    return res.status(400).json({
      status: 'error',
      message: `Invalid ${ext.replace('.', '').toUpperCase()} file. The file content does not match the expected format or signature.`,
    });
  }

  // Normalize standard MIME type based on verified extension
  let normalizedMime = mimetype;
  if (ext === '.pdf') {
    normalizedMime = 'application/pdf';
  } else if (ext === '.docx') {
    normalizedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (ext === '.txt') {
    normalizedMime = 'text/plain';
  }

  // 4. Insert metadata into PostgreSQL documents table
  try {
    const insertQuery = `
      INSERT INTO documents (user_id, filename, storage_path, file_size, mime_type, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, filename, file_size, mime_type, status, created_at;
    `;
    const values = [userId, originalname, storagePath, size, normalizedMime, 'pending'];

    const result = await pool.query(insertQuery, values);
    const document = result.rows[0];

    // 5. Trigger AI service processing
    try {
      await aiService.processDocument(document.id);
      document.status = 'completed';
    } catch (aiErr) {
      console.warn(`[AI Service] Processing notification warning for document ${document.id}:`, aiErr.message);
      // Upload remains recorded with status 'pending' if AI service is temporarily offline
    }

    // Return safe document metadata (internal storage_path is omitted for security)
    return res.status(201).json({
      status: 'success',
      message: 'Document uploaded and queued for processing successfully.',
      data: {
        document: {
          id: document.id,
          filename: document.filename,
          file_size: document.file_size,
          mime_type: document.mime_type,
          status: document.status,
          created_at: document.created_at,
        },
      },
    });
  } catch (error) {
    // If database insertion fails, remove the uploaded file from disk to prevent orphaned files
    if (fs.existsSync(storagePath)) {
      try {
        await fs.promises.unlink(storagePath);
      } catch (cleanupErr) {
        console.error('Failed to remove orphaned file after database error:', cleanupErr.message);
      }
    }

    console.error('Database insertion error during document upload:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to record document metadata. Upload aborted.',
    });
  }
};

/**
 * Handle RAG document chat query and persist conversation and message history
 * POST /api/documents/:id/chat
 */
export const chatWithDocument = async (req, res) => {
  const documentId = req.params.id || req.params.document_id;
  const { question, top_k, conversation_id, new_conversation } = req.body;
  const userId = req.user?.userId;

  // 1. Validate user authentication
  if (!userId) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized. User authentication required.',
    });
  }

  // 2. Validate document UUID format
  if (!isValidUuid(documentId)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid document ID format. A valid UUID is required.',
    });
  }

  // 3. Validate conversation UUID format if provided
  if (conversation_id && !isValidUuid(conversation_id)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid conversation ID format. A valid UUID is required.',
    });
  }

  // 4. Validate question
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({
      status: 'error',
      message: 'Question is required and cannot be empty.',
    });
  }

  // 5. Verify document existence and ownership in PostgreSQL
  try {
    const docQuery = 'SELECT id, user_id, filename, status FROM documents WHERE id = $1;';
    const docResult = await pool.query(docQuery, [documentId]);

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found.',
      });
    }

    const document = docResult.rows[0];

    // Enforce document ownership
    if (document.user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden. You do not have permission to access this document.',
      });
    }

    // 6. Forward request to FastAPI AI service
    const topKNum = Number.isInteger(top_k) && top_k > 0 ? top_k : 5;
    const aiResponse = await aiService.chatDocument(documentId, question.trim(), topKNum);

    // 7. Persist conversation and messages in a database transaction
    const client = await pool.connect();
    let conversationId = conversation_id;
    let userMessage;
    let assistantMessage;

    try {
      await client.query('BEGIN');

      if (conversationId) {
        // Verify provided conversation belongs to user and matches document
        const convCheck = await client.query(
          'SELECT id, document_id FROM conversations WHERE id = $1 AND user_id = $2;',
          [conversationId, userId]
        );
        if (convCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            status: 'error',
            message: 'Conversation not found or does not belong to the authenticated user.',
          });
        }
      } else if (!new_conversation) {
        // Find existing conversation for this document and user
        const existingConv = await client.query(
          'SELECT id FROM conversations WHERE user_id = $1 AND document_id = $2 ORDER BY created_at DESC LIMIT 1;',
          [userId, documentId]
        );
        if (existingConv.rows.length > 0) {
          conversationId = existingConv.rows[0].id;
        }
      }

      // If no existing conversation or new conversation requested, create one
      if (!conversationId) {
        const trimmedQ = question.trim();
        const convTitle = trimmedQ.length > 60 ? `${trimmedQ.slice(0, 57)}...` : trimmedQ;
        const newConv = await client.query(
          `INSERT INTO conversations (user_id, document_id, title)
           VALUES ($1, $2, $3)
           RETURNING id, title, created_at;`,
          [userId, documentId, convTitle || 'New Conversation']
        );
        conversationId = newConv.rows[0].id;
      }

      // Insert User Question into messages table
      const userMsgResult = await client.query(
        `INSERT INTO messages (conversation_id, role, content, sources)
         VALUES ($1, $2, $3, $4::jsonb)
         RETURNING id, conversation_id, role, content, sources, created_at;`,
        [conversationId, 'user', question.trim(), '[]']
      );
      userMessage = userMsgResult.rows[0];

      // Insert Gemini Assistant Answer into messages table
      const assistantMsgResult = await client.query(
        `INSERT INTO messages (conversation_id, role, content, sources)
         VALUES ($1, $2, $3, $4::jsonb)
         RETURNING id, conversation_id, role, content, sources, created_at;`,
        [
          conversationId,
          'assistant',
          aiResponse.answer,
          JSON.stringify(aiResponse.source_chunks || []),
        ]
      );
      assistantMessage = assistantMsgResult.rows[0];

      await client.query('COMMIT');
    } catch (persistErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw persistErr;
    } finally {
      client.release();
    }

    return res.status(200).json({
      status: 'success',
      data: {
        conversation_id: conversationId,
        answer: aiResponse.answer,
        source_chunks: aiResponse.source_chunks,
        user_message: userMessage,
        assistant_message: assistantMessage,
      },
    });
  } catch (error) {
    // Clear error handling if AI service is unavailable or temporarily busy
    if (error.isAiServiceUnavailable || error.statusCode === 503) {
      const busyMsg = error.message?.includes('AI is temporarily busy')
        ? 'AI is temporarily busy. Please try again in a moment.'
        : error.isAiServiceUnavailable
        ? 'AI Service is currently unavailable. Please ensure the AI service is running.'
        : error.message || 'AI is temporarily busy. Please try again in a moment.';

      return res.status(503).json({
        status: 'error',
        message: busyMsg,
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
      });
    }

    console.error('Error during document chat:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred while generating chat response.',
    });
  }
};

/**
 * Retrieve persistent chat history for a document
 * GET /api/documents/:id/chat
 * GET /api/documents/:id/history
 */
export const getDocumentChatHistory = async (req, res) => {
  const documentId = req.params.id || req.params.document_id;
  const userId = req.user?.userId;
  const { conversation_id, all } = req.query;

  // 1. Validate user authentication
  if (!userId) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized. User authentication required.',
    });
  }

  // 2. Validate document UUID format
  if (!isValidUuid(documentId)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid document ID format. A valid UUID is required.',
    });
  }

  // 3. Verify document existence and ownership
  try {
    const docQuery = 'SELECT id, user_id, filename, created_at FROM documents WHERE id = $1;';
    const docResult = await pool.query(docQuery, [documentId]);

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found.',
      });
    }

    const document = docResult.rows[0];

    // Enforce document ownership
    if (document.user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden. You do not have permission to access this document.',
      });
    }

    // 4. Retrieve conversations for this document and user
    const convQuery = `
      SELECT id, title, created_at
      FROM conversations
      WHERE user_id = $1 AND document_id = $2
      ORDER BY created_at DESC;
    `;
    const convResult = await pool.query(convQuery, [userId, documentId]);
    const conversations = convResult.rows;

    if (conversations.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          document_id: documentId,
          conversation_id: null,
          conversations: [],
          messages: [],
        },
      });
    }

    // 5. Retrieve messages
    let targetConversationId = null;
    let messages = [];

    if (conversation_id) {
      if (!isValidUuid(conversation_id)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid conversation ID format. A valid UUID is required.',
        });
      }
      const matchedConv = conversations.find((c) => c.id === conversation_id);
      if (!matchedConv) {
        return res.status(404).json({
          status: 'error',
          message: 'Conversation not found for this document.',
        });
      }
      targetConversationId = matchedConv.id;

      const msgQuery = `
        SELECT id, conversation_id, role, content, sources, created_at
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC;
      `;
      const msgResult = await pool.query(msgQuery, [targetConversationId]);
      messages = msgResult.rows;
    } else if (all === 'true') {
      // Retrieve all messages across all conversations for this document
      const msgQuery = `
        SELECT m.id, m.conversation_id, m.role, m.content, m.sources, m.created_at
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.document_id = $1 AND c.user_id = $2
        ORDER BY m.created_at ASC;
      `;
      const msgResult = await pool.query(msgQuery, [documentId, userId]);
      messages = msgResult.rows;
      targetConversationId = conversations[0].id;
    } else {
      // Default: retrieve messages from the latest conversation for this document
      targetConversationId = conversations[0].id;
      const msgQuery = `
        SELECT id, conversation_id, role, content, sources, created_at
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC;
      `;
      const msgResult = await pool.query(msgQuery, [targetConversationId]);
      messages = msgResult.rows;
    }

    return res.status(200).json({
      status: 'success',
      data: {
        document_id: documentId,
        conversation_id: targetConversationId,
        conversations,
        messages,
      },
    });
  } catch (error) {
    console.error('Error retrieving document chat history:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve chat history.',
    });
  }
};

/**
 * Retrieve all uploaded documents for the authenticated user
 * GET /api/documents
 */
export const getUserDocuments = async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized. User authentication required.',
    });
  }

  try {
    const query = `
      SELECT id, filename, file_size, mime_type, status, created_at
      FROM documents
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query, [userId]);

    return res.status(200).json({
      status: 'success',
      data: {
        documents: result.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching user documents:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve documents.',
    });
  }
};

/**
 * Permanently deletes a document, its chunks, embeddings, conversations, messages,
 * and associated file from storage with strict user ownership validation.
 * DELETE /api/documents/:id
 */
export const deleteDocument = async (req, res) => {
  const documentId = req.params.id;
  const userId = req.user?.userId;

  // 1. Validate user authentication
  if (!userId) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized. User authentication required.',
    });
  }

  // 2. Validate UUID format
  if (!isValidUuid(documentId)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid document ID format. A valid UUID is required.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 3. Verify document existence and lock row for update
    const docQuery = 'SELECT id, user_id, filename, storage_path FROM documents WHERE id = $1 FOR UPDATE;';
    const docResult = await client.query(docQuery, [documentId]);

    if (docResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Document not found.',
      });
    }

    const document = docResult.rows[0];

    // 4. Strict ownership check
    if (document.user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden. You do not have permission to delete this document.',
      });
    }

    // 5. Delete related messages from conversations belonging to this document and user
    await client.query(
      `DELETE FROM messages
       WHERE conversation_id IN (
         SELECT id FROM conversations WHERE document_id = $1 AND user_id = $2
       );`,
      [documentId, userId]
    );

    // 6. Delete conversations related to this document and user
    await client.query(
      'DELETE FROM conversations WHERE document_id = $1 AND user_id = $2;',
      [documentId, userId]
    );

    // 7. Delete document chunks & vector embeddings
    await client.query(
      'DELETE FROM document_chunks WHERE document_id = $1;',
      [documentId]
    );

    // 8. Delete document record
    await client.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2;',
      [documentId, userId]
    );

    await client.query('COMMIT');

    // 9. Delete physical file from storage if present on disk
    if (document.storage_path && fs.existsSync(document.storage_path)) {
      try {
        await fs.promises.unlink(document.storage_path);
      } catch (fileErr) {
        console.warn(`[WARN] Could not remove file on disk: ${document.storage_path}`, fileErr.message);
      }
    }

    return res.status(200).json({
      status: 'success',
      message: `Document "${document.filename}" and its associated chat history were permanently deleted successfully.`,
      data: {
        document_id: documentId,
        filename: document.filename,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error during document deletion:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete document. An internal server error occurred.',
    });
  } finally {
    client.release();
  }
};
