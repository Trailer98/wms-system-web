<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>库存查询</h2>
        <p>按仓库和 SKU 查询现存量、占用量与可用量。</p>
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
      :pagination="pagination"
      empty-text="暂无库存数据"
      @pagination-change="fetchInventory"
    >
      <template #availableQuantity="{ row }">
        <el-tag :type="row.availableQuantity > 0 ? 'success' : 'warning'" effect="plain">
          {{ row.availableQuantity }}
        </el-tag>
      </template>
    </CommonDataTable>
  </section>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import CommonQueryForm from '../components/common/CommonQueryForm.vue'
import { formatDateTime, normalizePageResponse } from '../utils/apiResponse'

const axios = inject('$axios')
const loading = ref(false)
const inventory = ref([])
const warehouses = ref([])
const skus = ref([])

const queryForm = reactive({
  warehouseId: '',
  skuId: ''
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
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
    attrs: { filterable: true }
  },
  {
    prop: 'skuId',
    label: 'SKU',
    type: 'select',
    placeholder: '请选择 SKU',
    options: skuOptions.value,
    attrs: { filterable: true }
  }
])

const tableColumns = [
  { prop: 'warehouseCode', label: '仓库编码', minWidth: 130 },
  { prop: 'warehouseName', label: '仓库名称', minWidth: 160, showOverflowTooltip: true },
  { prop: 'skuCode', label: 'SKU 编码', minWidth: 130 },
  { prop: 'skuName', label: 'SKU 名称', minWidth: 180, showOverflowTooltip: true },
  { prop: 'quantity', label: '现存量', width: 110, align: 'right' },
  { prop: 'reservedQuantity', label: '占用量', width: 110, align: 'right' },
  { label: '可用量', width: 110, slot: 'availableQuantity', align: 'right' },
  { label: '更新时间', minWidth: 170, formatter: (row) => formatDateTime(row.updatedAt) }
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
  if (queryForm.warehouseId) params.warehouseId = queryForm.warehouseId
  if (queryForm.skuId) params.skuId = queryForm.skuId
  return params
}

const fetchInventory = async () => {
  loading.value = true
  try {
    const response = await axios.get('/inventory', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    inventory.value = rows
    pagination.total = total
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
