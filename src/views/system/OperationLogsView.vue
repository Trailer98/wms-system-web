<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>日志查询</h2>
        <p>按操作人、操作类型、业务单号和时间范围查询系统操作日志。</p>
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
import CommonDataTable from '../../components/common/CommonDataTable.vue'
import CommonQueryForm from '../../components/common/CommonQueryForm.vue'
import { normalizePageResponse } from '../../utils/apiResponse'

const axios = inject('$axios')
const loading = ref(false)
const logs = ref([])

const BIZ_TYPE_LABELS = {
  INBOUND_ORDER: '入库单',
  OUTBOUND_ORDER: '出库单',
  STOCK_ADJUST_ORDER: '库存调整单',
  STOCK_COUNT_TASK: '库存盘点单',
  WMS_EXCEPTION: '异常事件'
}

const formatBizType = (bizType) => (bizType ? BIZ_TYPE_LABELS[bizType] || bizType : '-')

const queryForm = reactive({
  operator: '',
  operationType: '',
  bizNo: '',
  bizType: '',
  timeRange: []
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 20,
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
    prop: 'operationType',
    label: '操作类型',
    type: 'input',
    placeholder: '新增 / 修改 / 删除',
    trim: true
  },
  {
    prop: 'bizNo',
    label: '业务单号',
    type: 'input',
    placeholder: '请输入业务单号',
    trim: true
  },
  {
    prop: 'bizType',
    label: '业务类型',
    type: 'select',
    placeholder: '请选择业务类型',
    options: Object.entries(BIZ_TYPE_LABELS).map(([value, label]) => ({ value, label }))
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
    label: '业务类型',
    minWidth: 120,
    formatter: (row) => formatBizType(row.bizType)
  },
  {
    label: '业务单号',
    minWidth: 150,
    showOverflowTooltip: true,
    formatter: (row) => row.bizNo || '-'
  },
  {
    label: '业务ID',
    minWidth: 100,
    formatter: (row) => row.bizId ?? '-'
  },
  {
    label: 'IP 地址',
    minWidth: 130,
    formatter: (row) => row.ip || row.ipAddress || '-'
  },
  {
    label: '操作时间',
    minWidth: 170,
    formatter: (row) => row.createTime || '-'
  },
  {
    label: '内容',
    minWidth: 200,
    showOverflowTooltip: true,
    formatter: (row) => row.content || '-'
  }
]

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }

  if (queryForm.operator) params.operator = queryForm.operator
  if (queryForm.operationType) params.operationType = queryForm.operationType
  if (queryForm.bizNo) params.bizNo = queryForm.bizNo
  if (queryForm.bizType) params.bizType = queryForm.bizType
  if (queryForm.timeRange?.length === 2) {
    params.startTime = queryForm.timeRange[0]
    params.endTime = queryForm.timeRange[1]
  }

  return params
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const response = await axios.get('/operation-logs', {
      params: buildParams()
    })
    const { rows, total } = normalizePageResponse(response)
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
  queryForm.operationType = ''
  queryForm.bizNo = ''
  queryForm.bizType = ''
  queryForm.timeRange = []
  pagination.pageNum = 1
  fetchLogs()
}

onMounted(fetchLogs)
</script>

<style scoped>
</style>
