import { api } from '../plugins/axios'

// AI knowledge base P0. Backend context-path is /api and the axios baseURL is already /api, so paths
// here start at /ai/knowledge. Responses are the raw ApiResponse envelope ({ code, message, data });
// callers unwrap via normalizePageResponse / unwrapApiData like the rest of the app.

export const getKnowledgeDocumentsPage = (params) => api.get('/ai/knowledge/documents/page', { params })

export const getKnowledgeDocumentDetail = (id) => api.get(`/ai/knowledge/documents/${id}`)

export const createKnowledgeDocument = (payload) => api.post('/ai/knowledge/documents', payload)

export const updateKnowledgeDocument = (id, payload) => api.put(`/ai/knowledge/documents/${id}`, payload)

export const changeKnowledgeDocumentStatus = (id, status) =>
  api.patch(`/ai/knowledge/documents/${id}/status`, { status })

export const vectorizeKnowledgeDocument = (id, force = false) =>
  api.post(`/ai/knowledge/documents/${id}/vectorize`, { force })

export const getKnowledgeDocumentChunks = (id, params) =>
  api.get(`/ai/knowledge/documents/${id}/chunks`, { params })

export const searchKnowledge = (payload) => api.post('/ai/knowledge/search', payload)
