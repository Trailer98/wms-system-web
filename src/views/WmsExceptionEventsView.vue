<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>异常事件查询</h2>
        <p>查看入库、出库过程中产生的库位不可用、库存不足等异常记录，便于排查问题原因。</p>
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
      :data="events"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无异常事件数据"
      @pagination-change="fetchEvents"
    >
      <template #exceptionType="{ row }">
        <el-tag type="danger" effect="plain">{{ exceptionTypeLabel(row.exceptionType) }}</el-tag>
      </template>
      <template #status="{ row }">
        <el-tag :type="row.status === 'HANDLED' ? 'success' : 'warning'" effect="plain">
          {{ row.status === 'HANDLED' ? '已处理' : '待处理' }}
        </el-tag>
      </template>
      <template #actions="{ row }">
        <el-button type="primary" link @click="openDetail(row)">详情</el-button>
        <el-button
          v-if="row.status !== 'HANDLED'"
          type="success"
          link
          :loading="actionLoadingId === row.id"
          @click="markHandled(row)"
        >
          标记已处理
        </el-button>
      </template>
    </CommonDataTable>

    <el-dialog v-model="detailVisible" title="异常事件详情" width="560px">
      <el-descriptions v-if="activeEvent" :column="2" border>
        <el-descriptions-item label="异常类型">{{ exceptionTypeLabel(activeEvent.exceptionType) }}</el-descriptions-item>
        <el-descriptions-item label="业务单号">{{ activeEvent.bizNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="SKU">{{ [activeEvent.skuCode, activeEvent.skuName].filter(Boolean).join(' ') || '-' }}</el-descriptions-item>
        <el-descriptions-item label="仓库">{{ activeEvent.warehouseCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="库区">{{ activeEvent.areaCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="库位">{{ activeEvent.locationCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ activeEvent.status === 'HANDLED' ? '已处理' : '待处理' }}</el-descriptions-item>
        <el-descriptions-item label="处理人">{{ activeEvent.handlerId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="异常消息" :span="2">{{ activeEvent.message || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(activeEvent.createTime) }}</el-descriptions-item>
        <el-descriptions-item label="处理时间">{{ formatDateTime(activeEvent.handledTime) }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </section>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { computed, inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import CommonQueryForm from '../components/common/CommonQueryForm.vue'
import { formatDateTime, normalizePageResponse, unwrapApiData } from '../utils/apiResponse'

const axios = inject('$axios')
const loading = ref(false)
const actionLoadingId = ref(null)
const events = ref([])
const warehouses = ref([])
const skus = ref([])
const areaOptions = ref([])
const locationOptions = ref([])
const detailVisible = ref(false)
const activeEvent = ref(null)

const exceptionTypeOptions = [
  { label: 'SKU不存在', value: 'SKU_NOT_FOUND' },
  { label: '库位已停用', value: 'LOCATION_DISABLED' },
  { label: '库位已锁定', value: 'LOCATION_LOCKED' },
  { label: '库位盘点中', value: 'LOCATION_COUNTING' },
  { label: '库位容量不足', value: 'LOCATION_CAPACITY_NOT_ENOUGH' },
  { label: '库存不足', value: 'INVENTORY_NOT_ENOUGH' },
  { label: '库位不允许混放SKU', value: 'MIXED_SKU_NOT_ALLOWED' },
  { label: '单据状态不允许该操作', value: 'ORDER_STATUS_INVALID' },
  { label: '重复操作', value: 'DUPLICATE_OPERATION' }
]

const statusOptions = [
  { label: '待处理', value: 'OPEN' },
  { label: '已处理', value: 'HANDLED' }
]

const queryForm = reactive({
  exceptionType: '',
  bizNo: '',
  skuId: '',
  warehouseId: '',
  areaId: '',
  locationId: '',
  status: '',
  dateRange: []
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
})

const warehouseOptions = computed(() => warehouses.value.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })))
const skuOptions = computed(() => skus.value.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })))

const handleWarehouseChange = async () => {
  queryForm.areaId = ''
  queryForm.locationId = ''
  locationOptions.value = []
  if (!queryForm.warehouseId) {
    areaOptions.value = []
    return
  }
  const response = await axios.get(`/warehouse-areas/by-warehouse/${queryForm.warehouseId}`)
  const data = unwrapApiData(response)
  areaOptions.value = (Array.isArray(data) ? data : []).map((area) => ({ label: `${area.areaCode} - ${area.areaName}`, value: area.id }))
}

const handleAreaChange = async () => {
  queryForm.locationId = ''
  if (!queryForm.areaId) {
    locationOptions.value = []
    return
  }
  const response = await axios.get(`/warehouse-locations/by-area/${queryForm.areaId}`)
  const data = unwrapApiData(response)
  locationOptions.value = (Array.isArray(data) ? data : []).map((location) => ({ label: location.locationCode, value: location.id }))
}

const queryFields = computed(() => [
  { prop: 'exceptionType', label: '异常类型', type: 'select', placeholder: '请选择异常类型', options: exceptionTypeOptions },
  { prop: 'bizNo', label: '业务单号', type: 'input', placeholder: '请输入业务单号', trim: true },
  { prop: 'skuId', label: 'SKU', type: 'select', placeholder: '请选择 SKU', options: skuOptions.value, attrs: { filterable: true } },
  { prop: 'warehouseId', label: '仓库', type: 'select', placeholder: '请选择仓库', options: warehouseOptions.value, attrs: { filterable: true, onChange: handleWarehouseChange } },
  { prop: 'areaId', label: '库区', type: 'select', placeholder: '请先选择仓库', options: areaOptions.value, attrs: { filterable: true, disabled: !areaOptions.value.length, onChange: handleAreaChange } },
  { prop: 'locationId', label: '库位', type: 'select', placeholder: '请先选择库区', options: locationOptions.value, attrs: { filterable: true, disabled: !locationOptions.value.length } },
  { prop: 'status', label: '状态', type: 'select', placeholder: '请选择状态', options: statusOptions },
  { prop: 'dateRange', label: '创建时间', type: 'date-picker', placeholder: '请选择时间范围', attrs: { type: 'daterange', rangeSeparator: '至', startPlaceholder: '开始时间', endPlaceholder: '结束时间', valueFormat: 'YYYY-MM-DDTHH:mm:ss' } }
])

const tableColumns = [
  { label: '异常类型', width: 150, slot: 'exceptionType', align: 'center' },
  { prop: 'bizNo', label: '业务单号', minWidth: 140, formatter: (row) => row.bizNo || '-' },
  { prop: 'skuCode', label: 'SKU', minWidth: 130, formatter: (row) => `${row.skuCode || ''} ${row.skuName || ''}`.trim() || '-' },
  { prop: 'warehouseCode', label: '仓库', minWidth: 100, formatter: (row) => row.warehouseCode || '-' },
  { prop: 'areaCode', label: '库区', width: 90, formatter: (row) => row.areaCode || '-' },
  { prop: 'locationCode', label: '库位', width: 90, formatter: (row) => row.locationCode || '-' },
  { prop: 'message', label: '异常消息', minWidth: 220, showOverflowTooltip: true },
  { label: '状态', width: 90, slot: 'status', align: 'center' },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createTime) },
  { label: '处理时间', minWidth: 170, formatter: (row) => formatDateTime(row.handledTime) },
  { label: '操作', width: 150, slot: 'actions', fixed: 'right', align: 'center' }
]

const exceptionTypeLabel = (value) => exceptionTypeOptions.find((option) => option.value === value)?.label || value || '-'

const fetchOptions = async () => {
  const [warehouseResponse, skuResponse] = await Promise.all([
    axios.get('/warehouses', { params: { pageNum: 1, pageSize: 100 } }),
    axios.get('/skus', { params: { pageNum: 1, pageSize: 100 } })
  ])
  warehouses.value = normalizePageResponse(warehouseResponse).rows
  skus.value = normalizePageResponse(skuResponse).rows
}

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }
  if (queryForm.exceptionType) params.exceptionType = queryForm.exceptionType
  if (queryForm.bizNo) params.bizNo = queryForm.bizNo
  if (queryForm.skuId) params.skuId = queryForm.skuId
  if (queryForm.warehouseId) params.warehouseId = queryForm.warehouseId
  if (queryForm.areaId) params.areaId = queryForm.areaId
  if (queryForm.locationId) params.locationId = queryForm.locationId
  if (queryForm.status) params.status = queryForm.status
  if (queryForm.dateRange?.length === 2) {
    params.startTime = queryForm.dateRange[0]
    params.endTime = queryForm.dateRange[1]
  }
  return params
}

const fetchEvents = async () => {
  loading.value = true
  try {
    const response = await axios.get('/wms-exceptions/page', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    events.value = rows
    pagination.total = total
  } finally {
    loading.value = false
  }
}

const openDetail = (row) => {
  activeEvent.value = row
  detailVisible.value = true
}

const markHandled = async (row) => {
  actionLoadingId.value = row.id
  try {
    const response = await axios.patch(`/wms-exceptions/${row.id}/handled`)
    const updated = unwrapApiData(response)
    events.value = events.value.map((item) => (item.id === updated.id ? updated : item))
    ElMessage.success('异常事件已标记为已处理')
  } finally {
    actionLoadingId.value = null
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchEvents()
}

const handleReset = () => {
  queryForm.exceptionType = ''
  queryForm.bizNo = ''
  queryForm.skuId = ''
  queryForm.warehouseId = ''
  queryForm.areaId = ''
  queryForm.locationId = ''
  queryForm.status = ''
  queryForm.dateRange = []
  areaOptions.value = []
  locationOptions.value = []
  pagination.pageNum = 1
  fetchEvents()
}

onMounted(async () => {
  loading.value = true
  try {
    await fetchOptions()
    await fetchEvents()
  } finally {
    loading.value = false
  }
})
</script>
