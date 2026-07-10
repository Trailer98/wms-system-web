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

  // Tolerate every list-key convention we might meet (MyBatis-Plus uses `records`; other backends
  // use `list`/`rows`/`content`) so a single normalizer covers every paged endpoint in this app.
  const rows = payload.records || payload.list || payload.rows || payload.content || []

  const hasTotal = payload.total !== undefined && payload.total !== null
  const hasTotalElements = payload.totalElements !== undefined && payload.totalElements !== null
  if (!hasTotal && !hasTotalElements) {
    // The endpoint returned an object without a total — pagination will only ever show one page.
    // Fall back to rows.length so the count isn't wrong-looking, but flag it: this usually means a
    // non-paginated endpoint got fed through normalizePageResponse by mistake.
    console.warn('[normalizePageResponse] response has no `total`/`totalElements`; falling back to rows.length. This endpoint may not be paginated.')
  }

  // The backend serializes total/pageNum/pageSize (Java Long) as JSON strings ("6373"). Element Plus
  // el-pagination validates `total` as a Number and silently refuses to render if it's a String, so
  // every numeric paging field must be coerced here (the one place every list page reads them from).
  const rawTotal = payload.total ?? payload.totalElements ?? rows.length
  const rawPageNum = payload.pageNum ?? payload.current ?? 1
  const rawPageSize = payload.pageSize ?? payload.size ?? rows.length

  return {
    rows,
    total: Number(rawTotal) || 0,
    pageNum: Number(rawPageNum) || 1,
    pageSize: Number(rawPageSize) || rows.length || 20
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
    LOCKED: '已锁库',
    SHIPPED: '已发货',
    CANCELLED: '已取消'
  }

  return (type === 'outbound' ? outbound : inbound)[status] || status || '-'
}
