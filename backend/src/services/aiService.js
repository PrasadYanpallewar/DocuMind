import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export const getAiServiceUrl = () =>
  (process.env.AI_SERVICE_URL || 'https://documind-ai-yxgn.onrender.com').replace(/\/+$/, '');

export const AI_SERVICE_URL = getAiServiceUrl();

// Create configured Axios instance for AI service communication
const aiClient = axios.create({
  baseURL: getAiServiceUrl(),
  timeout: 60000, // 60 seconds timeout for AI generation (accounts for cold starts)
  headers: {
    'Content-Type': 'application/json',
  },
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
    const customErr = new Error('AI Service is currently unreachable. Please ensure the AI service is running.');
    customErr.statusCode = 503;
    customErr.isAiServiceUnavailable = true;
    throw customErr;
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    const customErr = new Error('AI Service request timed out.');
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
 * Triggers PDF text extraction, chunking, and vector embedding storage in the AI service.
 * POST /api/documents/:documentId/process
 *
 * @param {string} documentId - UUID of the uploaded document
 * @returns {Promise<Object>} AI service processing confirmation
 */
export const processDocument = async (documentId) => {
  try {
    const response = await aiClient.post(`/api/documents/${documentId}/process`);
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
    const response = await aiClient.post(`/api/documents/${documentId}/chat`, {
      question,
      top_k: topK,
    });
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
