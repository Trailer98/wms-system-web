import { api } from '../plugins/axios'
import { unwrapApiData } from '../utils/apiResponse'

export const getDictBatch = async (dictCodes) => {
  const response = await api.get('/sys-dicts/batch', { params: { dictCodes: dictCodes.join(',') } })
  return unwrapApiData(response) || {}
}

export const getDictItemsForAdmin = async (dictCode) => {
  const response = await api.get('/sys-dicts/items', { params: { dictCode } })
  return unwrapApiData(response) || []
}

export const getDictTypesPage = async (params) => {
  return api.get('/sys-dicts/types/page', { params })
}

export const createDictType = (payload) => api.post('/sys-dicts/types', payload)
export const updateDictType = (id, payload) => api.put(`/sys-dicts/types/${id}`, payload)
export const changeDictTypeStatus = (id, status) => api.put(`/sys-dicts/types/${id}/status`, { status })

export const createDictItem = (payload) => api.post('/sys-dicts/items', payload)
export const updateDictItem = (id, payload) => api.put(`/sys-dicts/items/${id}`, payload)
export const changeDictItemStatus = (id, status) => api.put(`/sys-dicts/items/${id}/status`, { status })
export const deleteDictItem = (id) => api.delete(`/sys-dicts/items/${id}`)
