import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

export const getAiServiceUrl = () =>
  (process.env.AI_SERVICE_URL || 'https://documind-ai-yxgn.onrender.com').replace(/\/+$/, '');

export const AI_SERVICE_URL = getAiServiceUrl();

// Sensible timeout below Render's ~100-second reverse-proxy limit for synchronous requests
const PROCESS_TIMEOUT_MS = parseInt(process.env.AI_PROCESS_TIMEOUT_MS, 10) || 90000; // 90 seconds
// Default client timeout for chat and operational requests
const DEFAULT_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS, 10) || 45000; // 45 seconds

// Create configured Axios instance for AI service communication
// NOTE: Do not set default 'Content-Type': 'application/json' here as it conflicts with multipart FormData
const aiClient = axios.create({
  baseURL: getAiServiceUrl(),
  timeout: DEFAULT_TIMEOUT_MS,
});

// Ensure any runtime updates to process.env.AI_SERVICE_URL are respected
aiClient.interceptors.request.use((config) => {
  config.baseURL = getAiServiceUrl();
  return config;
});

/**
 * Normalizes Axios errors from the AI service into descriptive application errors.
 *
 * @param {Error} error - Caught Axios or runtime error
 * @param {string} fallbackMessage - Default message if error has no detail
 */
const handleAiServiceError = (error, fallbackMessage) => {
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    console.error(`[AI Service Client Error] Unreachable host (${error.code}): ${error.message}`);
    const customErr = new Error('AI Service is currently unreachable. Please ensure the AI service is running.');
    customErr.statusCode = 503;
    customErr.isAiServiceUnavailable = true;
    throw customErr;
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    console.error(`[AI Service Client Error] Request timed out after ${error.config?.timeout || 'configured'}ms: ${error.message}`);
    const customErr = new Error('AI Service request timed out. The service may be waking up from cold start on Render or processing a large document.');
    customErr.statusCode = 504;
    throw customErr;
  }

  if (error.response) {
    const status = error.response.status;
    const detail = error.response.data?.detail || error.response.data?.message || fallbackMessage;
    const customErr = new Error(detail);
    customErr.statusCode = status;
    customErr.responseData = error.response.data;
    throw customErr;
  }

  const genericErr = new Error(error.message || fallbackMessage);
  genericErr.statusCode = 500;
  throw genericErr;
};

/**
 * Triggers document text extraction, chunking, and vector embedding storage in the AI service.
 * Streams the actual uploaded file bytes via multipart/form-data.
 * POST /api/documents/:documentId/process
 *
 * @param {string} documentId - UUID of the uploaded document
 * @param {string} [filePath] - Local filesystem path of the uploaded file to forward
 * @param {string} [originalFilename] - Original filename of the document
 * @returns {Promise<Object>} AI service processing confirmation
 */
export const processDocument = async (documentId, filePath, originalFilename) => {
  try {
    const targetUrl = `${getAiServiceUrl()}/api/documents/${documentId}/process`;
    console.log(`[AI Service Client] Forwarding document ${documentId} to ${targetUrl}...`);

    let response;
    if (filePath && fs.existsSync(filePath)) {
      const stats = await fs.promises.stat(filePath);
      const filename = originalFilename || path.basename(filePath);
      console.log(`[AI Service Client] Reading file for multipart forward: "${filename}" (${stats.size} bytes)`);

      const fileBuffer = await fs.promises.readFile(filePath);
      const blob = new Blob([fileBuffer]);

      const formData = new FormData();
      formData.append('file', blob, filename);

      // Do NOT manually specify 'Content-Type': 'multipart/form-data'.
      // Axios and Node.js FormData automatically construct the multipart boundary header (e.g. multipart/form-data; boundary=...).
      // Setting Content-Type to undefined guarantees Axios computes the boundary rather than overriding it.
      response = await aiClient.post(`/api/documents/${documentId}/process`, formData, {
        headers: {
          'Content-Type': undefined,
        },
        timeout: PROCESS_TIMEOUT_MS,
      });
    } else {
      console.warn(`[AI Service Client] No file path provided or file missing on disk for document ${documentId}. Triggering process without file payload.`);
      response = await aiClient.post(`/api/documents/${documentId}/process`, null, {
        timeout: PROCESS_TIMEOUT_MS,
      });
    }

    console.log(`[AI Service Client] Processing response for document ${documentId}: status=${response.data?.status || 'unknown'}`);
    return response.data;
  } catch (error) {
    handleAiServiceError(error, `Failed to process document ${documentId}`);
  }
};

/**
 * Forwards a user question and document ID to the AI service RAG endpoint.
 * POST /api/documents/:documentId/chat
 *
 * @param {string} documentId - UUID of the target document
 * @param {string} question - Question about document content
 * @param {number} [topK=5] - Number of relevant chunks to retrieve
 * @returns {Promise<Object>} RAG chat response with answer and citations
 */
export const chatDocument = async (documentId, question, topK = 5) => {
  try {
    const response = await aiClient.post(
      `/api/documents/${documentId}/chat`,
      {
        question,
        top_k: topK,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: DEFAULT_TIMEOUT_MS,
      }
    );
    return response.data;
  } catch (error) {
    handleAiServiceError(error, `Failed to generate chat response for document ${documentId}`);
  }
};

/**
 * Checks health status of the configured AI Service.
 * GET /health
 *
 * @returns {Promise<Object>} Operational status object from the AI service
 */
export const checkHealth = async () => {
  try {
    const response = await aiClient.get('/health');
    return response.data;
  } catch (error) {
    handleAiServiceError(error, 'AI Service health check failed');
  }
};

export default {
  processDocument,
  chatDocument,
  checkHealth,
  getAiServiceUrl,
  AI_SERVICE_URL,
};
