<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>库存流水</h2>
        <p>查看入库、出库、锁库、解锁等库存变更明细，支持按业务类型、单号和时间范围筛选。</p>
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
      :data="transactions"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无库存流水数据"
      @pagination-change="fetchTransactions"
    >
      <template #type="{ row }">
        <el-tag :type="row.bizTypeTagType || ''" effect="plain">{{ row.bizTypeLabel || row.type }}</el-tag>
      </template>
      <template #operationType="{ row }">
        <el-tag :type="row.operationTypeTagType || ''" effect="plain">{{ row.operationTypeLabel || row.operationType }}</el-tag>
      </template>
      <template #actions="{ row }">
        <el-button type="primary" link @click="openDetail(row)">详情</el-button>
      </template>
    </CommonDataTable>

    <el-dialog v-model="detailVisible" title="库存流水详情" width="560px">
      <el-descriptions v-if="activeMovement" :column="2" border>
        <el-descriptions-item label="业务类型">{{ activeMovement.bizTypeLabel || activeMovement.type }}</el-descriptions-item>
        <el-descriptions-item label="操作类型">{{ activeMovement.operationTypeLabel || activeMovement.operationType }}</el-descriptions-item>
        <el-descriptions-item label="业务单号">{{ activeMovement.businessNo }}</el-descriptions-item>
        <el-descriptions-item label="SKU">{{ activeMovement.skuCode }} {{ activeMovement.skuName }}</el-descriptions-item>
        <el-descriptions-item label="仓库">{{ activeMovement.warehouseCode }}</el-descriptions-item>
        <el-descriptions-item label="库区">{{ activeMovement.areaCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="库位">{{ activeMovement.locationCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="变更数量">{{ activeMovement.quantityChange }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ activeMovement.operator || '-' }}</el-descriptions-item>
        <el-descriptions-item label="现存量" :span="2">{{ activeMovement.beforeQuantity ?? '-' }} → {{ activeMovement.afterQuantity ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="锁定量" :span="2">{{ activeMovement.beforeReservedQuantity ?? '-' }} → {{ activeMovement.afterReservedQuantity ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="冻结量" :span="2">{{ activeMovement.beforeFrozenQuantity ?? '-' }} → {{ activeMovement.afterFrozenQuantity ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="可用量" :span="2">{{ activeMovement.beforeAvailableQuantity ?? '-' }} → {{ activeMovement.afterAvailableQuantity ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="操作时间" :span="2">{{ formatDateTime(activeMovement.occurredAt) }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ activeMovement.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import CommonQueryForm from '../components/common/CommonQueryForm.vue'
import { useDict } from '../composables/useDict'
import { formatDateTime, normalizePageResponse } from '../utils/apiResponse'

const axios = inject('$axios')
const loading = ref(false)
const transactions = ref([])
const warehouses = ref([])
const skus = ref([])
const areaOptions = ref([])
const locationOptions = ref([])
const detailVisible = ref(false)
const activeMovement = ref(null)

const BIZ_TYPE_DICT = 'stock_movement_biz_type'
const OPERATION_TYPE_DICT = 'stock_movement_operation_type'
const { preload: preloadDicts, getDictOptions } = useDict([BIZ_TYPE_DICT, OPERATION_TYPE_DICT])

// Filter-dropdown options come from the dictionary (business logic never depends on this list — see
// SysDictService). If the dictionary endpoint is unreachable, getDictOptions() just returns [], so the
// dropdowns render empty instead of throwing; the page and its list/detail label rendering (which read
// bizTypeLabel/operationTypeLabel straight off each row, already resolved server-side) stay usable.
const movementTypeOptions = computed(() => getDictOptions(BIZ_TYPE_DICT))
const operationTypeOptions = computed(() => getDictOptions(OPERATION_TYPE_DICT))

const queryForm = reactive({
  skuId: '',
  warehouseId: '',
  areaId: '',
  locationId: '',
  type: '',
  operationType: '',
  businessNo: '',
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
  const data = response?.data ?? response
  areaOptions.value = (Array.isArray(data) ? data : []).map((area) => ({ label: `${area.areaCode} - ${area.areaName}`, value: area.id }))
}

const handleAreaChange = async () => {
  queryForm.locationId = ''
  if (!queryForm.areaId) {
    locationOptions.value = []
    return
  }
  const response = await axios.get(`/warehouse-locations/by-area/${queryForm.areaId}`)
  const data = response?.data ?? response
  locationOptions.value = (Array.isArray(data) ? data : []).map((location) => ({ label: location.locationCode, value: location.id }))
}

const queryFields = computed(() => [
  { prop: 'businessNo', label: '业务单号', type: 'input', placeholder: '请输入业务单号', trim: true },
  { prop: 'type', label: '业务类型', type: 'select', placeholder: '请选择业务类型', options: movementTypeOptions.value },
  { prop: 'operationType', label: '操作类型', type: 'select', placeholder: '请选择操作类型', options: operationTypeOptions.value },
  { prop: 'skuId', label: 'SKU', type: 'select', placeholder: '请选择 SKU', options: skuOptions.value, attrs: { filterable: true } },
  { prop: 'warehouseId', label: '仓库', type: 'select', placeholder: '请选择仓库', options: warehouseOptions.value, attrs: { filterable: true, onChange: handleWarehouseChange } },
  { prop: 'areaId', label: '库区', type: 'select', placeholder: '请先选择仓库', options: areaOptions.value, attrs: { filterable: true, disabled: !areaOptions.value.length, onChange: handleAreaChange } },
  { prop: 'locationId', label: '库位', type: 'select', placeholder: '请先选择库区', options: locationOptions.value, attrs: { filterable: true, disabled: !locationOptions.value.length } },
  { prop: 'dateRange', label: '操作时间', type: 'date-picker', placeholder: '请选择时间范围', attrs: { type: 'daterange', rangeSeparator: '至', startPlaceholder: '开始时间', endPlaceholder: '结束时间', valueFormat: 'YYYY-MM-DDTHH:mm:ss' } }
])

const tableColumns = [
  { label: '业务类型', width: 90, slot: 'type', align: 'center' },
  { label: '操作类型', width: 120, slot: 'operationType', align: 'center' },
  { prop: 'businessNo', label: '业务单号', minWidth: 140 },
  { prop: 'skuCode', label: 'SKU', minWidth: 130, formatter: (row) => `${row.skuCode || ''} ${row.skuName || ''}`.trim() || '-' },
  { prop: 'warehouseCode', label: '仓库', minWidth: 100 },
  { prop: 'areaCode', label: '库区', width: 90, formatter: (row) => row.areaCode || '-' },
  { prop: 'locationCode', label: '库位', width: 90, formatter: (row) => row.locationCode || '-' },
  { prop: 'quantityChange', label: '变更数量', width: 90, align: 'right' },
  { prop: 'beforeAvailableQuantity', label: '变更前可用', width: 100, align: 'right', formatter: (row) => row.beforeAvailableQuantity ?? '-' },
  { prop: 'afterAvailableQuantity', label: '变更后可用', width: 100, align: 'right', formatter: (row) => row.afterAvailableQuantity ?? '-' },
  { label: '操作时间', minWidth: 170, formatter: (row) => formatDateTime(row.occurredAt) },
  { label: '操作', width: 90, slot: 'actions', fixed: 'right', align: 'center' }
]

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
  if (queryForm.skuId) params.skuId = queryForm.skuId
  if (queryForm.warehouseId) params.warehouseId = queryForm.warehouseId
  if (queryForm.areaId) params.areaId = queryForm.areaId
  if (queryForm.locationId) params.locationId = queryForm.locationId
  if (queryForm.type) params.type = queryForm.type
  if (queryForm.operationType) params.operationType = queryForm.operationType
  if (queryForm.businessNo) params.businessNo = queryForm.businessNo
  if (queryForm.dateRange?.length === 2) {
    params.startTime = queryForm.dateRange[0]
    params.endTime = queryForm.dateRange[1]
  }
  return params
}

const fetchTransactions = async () => {
  loading.value = true
  try {
    const response = await axios.get('/inventory/transactions/page', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    transactions.value = rows
    pagination.total = total
  } finally {
    loading.value = false
  }
}

const openDetail = (row) => {
  activeMovement.value = row
  detailVisible.value = true
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchTransactions()
}

const handleReset = () => {
  queryForm.skuId = ''
  queryForm.warehouseId = ''
  queryForm.areaId = ''
  queryForm.locationId = ''
  queryForm.type = ''
  queryForm.operationType = ''
  queryForm.businessNo = ''
  queryForm.dateRange = []
  areaOptions.value = []
  locationOptions.value = []
  pagination.pageNum = 1
  fetchTransactions()
}

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([preloadDicts(), fetchOptions()])
    await fetchTransactions()
  } finally {
    loading.value = false
  }
})
</script>
