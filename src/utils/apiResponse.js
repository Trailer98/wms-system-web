export const unwrapApiData = (response) => {
  if (response && typeof response === 'object' && 'code' in response && 'data' in response) {
    return response.data
  }

  if (response && typeof response === 'object' && 'data' in response) {
    return response.data
  }

  return response
}

export const normalizePageResponse = (response) => {
  const payload = unwrapApiData(response)

  if (Array.isArray(payload)) {
    return {
      rows: payload,
      total: payload.length,
      pageNum: 1,
      pageSize: payload.length
    }
  }

  if (!payload || typeof payload !== 'object') {
    return {
      rows: [],
      total: 0,
      pageNum: 1,
      pageSize: 10
    }
  }

  const rows = payload.records || payload.list || payload.content || []

  return {
    rows,
    total: payload.total ?? payload.totalElements ?? rows.length,
    pageNum: payload.pageNum ?? payload.current ?? 1,
    pageSize: payload.pageSize ?? payload.size ?? rows.length
  }
}

export const formatDateTime = (value) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export const boolLabel = (value) => (value ? '启用' : '停用')

export const orderStatusLabel = (status, type) => {
  const inbound = {
    CREATED: '已创建',
    RECEIVED: '已收货'
  }
  const outbound = {
    CREATED: '已创建',
    SHIPPED: '已发货'
  }

  return (type === 'outbound' ? outbound : inbound)[status] || status || '-'
}
