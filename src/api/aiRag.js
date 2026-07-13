import { api } from '../plugins/axios'

// RAG static-knowledge Q&A (P0). Backend context-path is /api and the axios baseURL is already /api,
// so the path here is /ai/rag/ask. Only static WMS knowledge is used — never real-time inventory,
// orders or movements.

export const askRag = (payload) => api.post('/ai/rag/ask', payload)
