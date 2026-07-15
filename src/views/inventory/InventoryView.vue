<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>库存查询</h2>
        <p>按仓库、库区、库位和 SKU 查询现存量、锁定量、冻结量与可用量。</p>
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
      :data="inventory"
      :columns="tableColumns"
      :loading="loading"
      :show-pagination="false"
      empty-text="暂无库存数据"
    >
      <template #inventoryStatus="{ row }">
        <el-tag :type="row.inventoryStatus === 'NORMAL' ? 'success' : 'danger'" effect="plain">
          {{ inventoryStatusLabel(row.inventoryStatus) }}
        </el-tag>
      </template>
      <template #availableQuantity="{ row }">
        <el-tag :type="row.availableQuantity > 0 ? 'success' : 'warning'" effect="plain">
          {{ row.availableQuantity }}
        </el-tag>
      </template>
      <template #actions="{ row }">
        <el-button
          v-if="authStore.hasPermission('stock-adjust:create')"
          type="primary"
          link
          @click="goToAdjust(row)"
        >
          调整
        </el-button>
      </template>
    </CommonDataTable>

    <!-- Explicit, always-rendered pagination in this page's own template (no v-if that could hide it). -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.pageNum"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import CommonDataTable from '../../components/common/CommonDataTable.vue'
import CommonQueryForm from '../../components/common/CommonQueryForm.vue'
import { useAuthStore } from '../../stores/auth'
import { formatDateTime, normalizePageResponse } from '../../utils/apiResponse'

const axios = inject('$axios')
const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const inventory = ref([])
const warehouses = ref([])
const skus = ref([])
const areaOptions = ref([])
const locationOptions = ref([])

const inventoryStatusOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '异常', value: 'EXCEPTION' }
]

const queryForm = reactive({
  warehouseId: '',
  skuId: '',
  areaId: '',
  locationId: '',
  inventoryStatus: ''
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 20,
  total: 0
})

const warehouseOptions = computed(() => warehouses.value.map((item) => ({
  label: `${item.code} - ${item.name}`,
  value: item.id
})))

const skuOptions = computed(() => skus.value.map((item) => ({
  label: `${item.code} - ${item.name}`,
  value: item.id
})))

const queryFields = computed(() => [
  {
    prop: 'warehouseId',
    label: '仓库',
    type: 'select',
    placeholder: '请选择仓库',
    options: warehouseOptions.value,
    attrs: { filterable: true, onChange: handleWarehouseChange }
  },
  {
    prop: 'areaId',
    label: '库区',
    type: 'select',
    placeholder: '请先选择仓库',
    options: areaOptions.value,
    attrs: { filterable: true, disabled: !areaOptions.value.length, onChange: handleAreaChange }
  },
  {
    prop: 'locationId',
    label: '库位',
    type: 'select',
    placeholder: '请先选择库区',
    options: locationOptions.value,
    attrs: { filterable: true, disabled: !locationOptions.value.length }
  },
  {
    prop: 'skuId',
    label: 'SKU',
    type: 'select',
    placeholder: '请选择 SKU',
    options: skuOptions.value,
    attrs: { filterable: true }
  },
  {
    prop: 'inventoryStatus',
    label: '库存状态',
    type: 'select',
    placeholder: '请选择库存状态',
    options: inventoryStatusOptions
  }
])

const tableColumns = [
  { prop: 'warehouseCode', label: '仓库编码', minWidth: 120 },
  { prop: 'warehouseName', label: '仓库名称', minWidth: 140, showOverflowTooltip: true },
  { prop: 'areaCode', label: '库区', minWidth: 100, formatter: (row) => row.areaCode || '-' },
  { prop: 'locationCode', label: '库位', minWidth: 100, formatter: (row) => row.locationCode || '-' },
  { prop: 'skuCode', label: 'SKU 编码', minWidth: 120 },
  { prop: 'skuName', label: 'SKU 名称', minWidth: 160, showOverflowTooltip: true },
  { label: '库存状态', width: 90, slot: 'inventoryStatus', align: 'center' },
  { prop: 'quantity', label: '现存量', width: 100, align: 'right' },
  { prop: 'reservedQuantity', label: '锁定量', width: 100, align: 'right' },
  { prop: 'frozenQuantity', label: '冻结量', width: 100, align: 'right' },
  { label: '可用量', width: 100, slot: 'availableQuantity', align: 'right' },
  { label: '更新时间', minWidth: 170, formatter: (row) => formatDateTime(row.updatedAt) },
  { label: '操作', width: 90, slot: 'actions', fixed: 'right', align: 'center' }
]

const goToAdjust = (row) => {
  router.push({ path: '/stock-adjust-orders', query: { inventoryId: row.id } })
}

const inventoryStatusLabel = (value) => inventoryStatusOptions.find((option) => option.value === value)?.label || value || '-'

const fetchOptions = async () => {
  const [warehouseResponse, skuResponse] = await Promise.all([
    axios.get('/warehouses', { params: { pageNum: 1, pageSize: 100 } }),
    axios.get('/skus', { params: { pageNum: 1, pageSize: 100 } })
  ])
  warehouses.value = normalizePageResponse(warehouseResponse).rows
  skus.value = normalizePageResponse(skuResponse).rows
}

const loadAreasByWarehouse = async (warehouseId) => {
  if (!warehouseId) return []
  const response = await axios.get(`/warehouse-areas/by-warehouse/${warehouseId}`)
  const data = response?.data ?? response
  return Array.isArray(data) ? data : []
}

const loadLocationsByArea = async (areaId) => {
  if (!areaId) return []
  const response = await axios.get(`/warehouse-locations/by-area/${areaId}`)
  const data = response?.data ?? response
  return Array.isArray(data) ? data : []
}

const handleWarehouseChange = async () => {
  queryForm.areaId = ''
  queryForm.locationId = ''
  locationOptions.value = []
  const areas = await loadAreasByWarehouse(queryForm.warehouseId)
  areaOptions.value = areas.map((area) => ({ label: `${area.areaCode} - ${area.areaName}`, value: area.id }))
}

const handleAreaChange = async () => {
  queryForm.locationId = ''
  const locations = await loadLocationsByArea(queryForm.areaId)
  locationOptions.value = locations.map((location) => ({ label: location.locationCode, value: location.id }))
}

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }
  if (queryForm.warehouseId) params.warehouseId = queryForm.warehouseId
  if (queryForm.skuId) params.skuId = queryForm.skuId
  if (queryForm.areaId) params.areaId = queryForm.areaId
  if (queryForm.locationId) params.locationId = queryForm.locationId
  if (queryForm.inventoryStatus) params.inventoryStatus = queryForm.inventoryStatus
  return params
}

const fetchInventory = async () => {
  loading.value = true
  try {
    // The axios interceptor returns the API envelope { code, message, data }, so the paged body is res.data.
    const res = await axios.get('/inventory', { params: buildParams() })
    const page = res?.data ?? res ?? {}
    inventory.value = Array.isArray(page.records) ? page.records : []
    // The backend serializes total (a Long) as a JSON string ("6373"). el-pagination's `total` prop
    // is validated as Number — a String value fails that check and the component never renders into
    // the DOM (querySelectorAll('.el-pagination').length === 0). Coerce every numeric field to Number.
    pagination.total = Number(page.total ?? 0)
    pagination.pageNum = Number(page.pageNum ?? pagination.pageNum)
    pagination.pageSize = Number(page.pageSize ?? pagination.pageSize)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchInventory()
}

const handleReset = () => {
  queryForm.warehouseId = ''
  queryForm.skuId = ''
  queryForm.areaId = ''
  queryForm.locationId = ''
  queryForm.inventoryStatus = ''
  areaOptions.value = []
  locationOptions.value = []
  pagination.pageNum = 1
  fetchInventory()
}

// Clicking a page number: set the new page and re-query (request goes out with pageNum=<clicked>).
const handleCurrentChange = (page) => {
  pagination.pageNum = page
  fetchInventory()
}

// Changing page size: reset to page 1 (per spec) and re-query with the new pageSize.
const handleSizeChange = (size) => {
  pagination.pageSize = size
  pagination.pageNum = 1
  fetchInventory()
}

onMounted(async () => {
  loading.value = true
  try {
    await fetchOptions()
    await fetchInventory()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.pagination-container {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
