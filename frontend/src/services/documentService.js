import api from './api';

export const documentService = {
  /**
   * Fetch all documents for the authenticated user
   * GET /api/documents
   */
  async getDocuments() {
    const response = await api.get('/api/documents');
    return response.data;
  },

  /**
   * Upload a PDF document
   * POST /api/documents/upload
   */
  async uploadDocument(file, onUploadProgress) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    return response.data;
  },

  /**
   * Send a question to Gemini RAG chat for a document
   * POST /api/documents/:id/chat
   */
  async chatWithDocument(documentId, question, topK = 5, conversationId = null, newConversation = false) {
    const payload = {
      question,
      top_k: topK,
    };
    if (conversationId) {
      payload.conversation_id = conversationId;
    }
    if (newConversation) {
      payload.new_conversation = true;
    }
    const response = await api.post(`/api/documents/${documentId}/chat`, payload);
    return response.data;
  },

  /**
   * Retrieve chat history for a document
   * GET /api/documents/:id/history
   */
  async getChatHistory(documentId, conversationId = null) {
    const params = {};
    if (conversationId) {
      params.conversation_id = conversationId;
    }
    const response = await api.get(`/api/documents/${documentId}/history`, { params });
    return response.data;
  },

  /**
   * Permanently delete a document and its associated vector chunks and chat history
   * DELETE /api/documents/:id
   */
  async deleteDocument(documentId) {
    const response = await api.delete(`/api/documents/${documentId}`);
    return response.data;
  },
};

export default documentService;
