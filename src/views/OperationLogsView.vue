<template>
  <section class="logs-page">
    <div class="page-header">
      <div>
        <h2>日志查询</h2>
        <p>按操作人、模块、状态和时间范围查询系统操作日志。</p>
      </div>
    </div>

    <CommonQueryForm
      :model="queryForm"
      :fields="queryFields"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <CommonDataTable
      :data="logs"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无日志数据"
      @pagination-change="fetchLogs"
    />
  </section>
</template>

<script setup>
import { inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import CommonQueryForm from '../components/common/CommonQueryForm.vue'

const axios = inject('$axios')
const loading = ref(false)
const logs = ref([])

const queryForm = reactive({
  operator: '',
  module: '',
  operationType: '',
  status: '',
  timeRange: []
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
})

const queryFields = [
  {
    prop: 'operator',
    label: '操作人',
    type: 'input',
    placeholder: '请输入操作人',
    trim: true
  },
  {
    prop: 'module',
    label: '模块',
    type: 'input',
    placeholder: '请输入模块',
    trim: true
  },
  {
    prop: 'operationType',
    label: '操作类型',
    type: 'input',
    placeholder: '新增 / 修改 / 删除',
    trim: true
  },
  {
    prop: 'timeRange',
    label: '时间范围',
    type: 'date-picker',
    col: {
      xs: 24,
      md: 12
    },
    attrs: {
      type: 'datetimerange',
      rangeSeparator: '至',
      startPlaceholder: '开始时间',
      endPlaceholder: '结束时间',
      valueFormat: 'YYYY-MM-DDTHH:mm:ss'
    }
  }
]

const tableColumns = [
  {
    label: '操作人',
    minWidth: 120,
    formatter: (row) => row.operator || row.username || row.userName || '-'
  },
  {
    label: '操作类型',
    minWidth: 120,
    formatter: (row) => row.operationType || row.type || row.action || '-'
  },
  {
    label: '请求地址',
    minWidth: 180,
    showOverflowTooltip: true,
    formatter: (row) => row.requestUri || row.url || row.path || '-'
  },
  {
    label: 'IP 地址',
    minWidth: 130,
    formatter: (row) => row.ip || row.ipAddress || '-'
  },
  {
    label: '操作时间',
    minWidth: 170,
    formatter: (row) => row.operationTime || row.createTime || row.createdAt || '-'
  },
  {
    label: '描述',
    minWidth: 200,
    showOverflowTooltip: true,
    formatter: (row) => row.description || row.remark || row.message || '-'
  }
]

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }

  if (queryForm.operator) params.operator = queryForm.operator
  if (queryForm.module) params.module = queryForm.module
  if (queryForm.operationType) params.operationType = queryForm.operationType
  if (queryForm.status) params.status = queryForm.status
  if (queryForm.timeRange?.length === 2) {
    params.startTime = queryForm.timeRange[0]
    params.endTime = queryForm.timeRange[1]
  }

  return params
}

const normalizeResponse = (response) => {
  const payload = response?.data ?? response
  const pageData = payload?.records
    ? payload
    : payload?.data?.records
      ? payload.data
      : payload?.list
        ? payload
        : payload?.data?.list
          ? payload.data
          : payload?.content
            ? payload
            : payload?.data?.content
              ? payload.data
              : null

  if (Array.isArray(payload)) {
    return {
      rows: payload,
      total: payload.length
    }
  }

  if (Array.isArray(payload?.data)) {
    return {
      rows: payload.data,
      total: payload.total ?? payload.data.length
    }
  }

  if (pageData) {
    const rows = pageData.records || pageData.list || pageData.content || []
    return {
      rows,
      total: pageData.total ?? pageData.totalElements ?? rows.length
    }
  }

  return {
    rows: [],
    total: 0
  }
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const response = await axios.get('/operation-logs', {
      params: buildParams()
    })
    const { rows, total } = normalizeResponse(response)
    logs.value = rows
    pagination.total = total
  } catch (error) {
    logs.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchLogs()
}

const handleReset = () => {
  queryForm.operator = ''
  queryForm.module = ''
  queryForm.operationType = ''
  queryForm.status = ''
  queryForm.timeRange = []
  pagination.pageNum = 1
  fetchLogs()
}

onMounted(fetchLogs)
</script>

<style scoped>
.logs-page {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 8px;
  color: #111827;
}

.page-header p {
  margin: 0;
  color: #64748b;
}

@media (max-width: 768px) {
  .logs-page {
    padding: 16px;
  }
}
</style>
