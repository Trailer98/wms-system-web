<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>出库单查询</h2>
        <p>查询已创建的出库单，并对未发货的单据执行发货扣减库存。</p>
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
      :data="orders"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无出库单数据"
      @pagination-change="fetchOrders"
    >
      <template #status="{ row }">
        <el-tag :type="row.status === 'SHIPPED' ? 'success' : 'warning'" effect="plain">
          {{ orderStatusLabel(row.status, 'outbound') }}
        </el-tag>
      </template>
      <template #items="{ row }">
        <span>{{ formatItems(row.items) }}</span>
      </template>
      <template #actions="{ row }">
        <el-button
          type="primary"
          link
          :disabled="row.status !== 'CREATED'"
          :loading="actionLoadingId === row.id"
          @click="shipOrder(row)"
        >
          发货
        </el-button>
      </template>
    </CommonDataTable>
  </section>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import CommonQueryForm from '../components/common/CommonQueryForm.vue'
import { formatDateTime, normalizePageResponse, orderStatusLabel, unwrapApiData } from '../utils/apiResponse'

const axios = inject('$axios')
const loading = ref(false)
const actionLoadingId = ref(null)
const orders = ref([])

const queryForm = reactive({
  orderNo: '',
  status: ''
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
})

const queryFields = [
  {
    prop: 'orderNo',
    label: '出库单号',
    type: 'input',
    placeholder: '请输入出库单号',
    trim: true
  },
  {
    prop: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { label: '已创建', value: 'CREATED' },
      { label: '已发货', value: 'SHIPPED' }
    ]
  }
]

const tableColumns = [
  { prop: 'orderNo', label: '出库单号', minWidth: 150 },
  { label: '状态', width: 110, slot: 'status', align: 'center' },
  { prop: 'warehouseCode', label: '仓库', minWidth: 120 },
  { prop: 'customerName', label: '客户', minWidth: 160, showOverflowTooltip: true },
  { label: '明细', minWidth: 260, slot: 'items', showOverflowTooltip: true },
  { label: '发货时间', minWidth: 170, formatter: (row) => formatDateTime(row.shippedAt) },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) },
  { label: '操作', width: 100, slot: 'actions', fixed: 'right', align: 'center' }
]

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }

  if (queryForm.orderNo) params.orderNo = queryForm.orderNo
  if (queryForm.status) params.status = queryForm.status

  return params
}

const fetchOrders = async () => {
  loading.value = true
  try {
    const response = await axios.get('/outbound-orders', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    orders.value = rows
    pagination.total = total
  } catch (error) {
    orders.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchOrders()
}

const handleReset = () => {
  queryForm.orderNo = ''
  queryForm.status = ''
  pagination.pageNum = 1
  fetchOrders()
}

const shipOrder = async (row) => {
  actionLoadingId.value = row.id
  try {
    const response = await axios.post(`/outbound-orders/${row.id}/ship`)
    const nextOrder = unwrapApiData(response)
    orders.value = orders.value.map((item) => (item.id === row.id ? nextOrder : item))
    ElMessage.success('出库单发货成功')
  } finally {
    actionLoadingId.value = null
  }
}

const formatItems = (items = []) => {
  if (!items.length) return '-'
  return items.map((item) => `${item.skuCode || item.skuId} x ${item.quantity}`).join('；')
}

onMounted(fetchOrders)
</script>
