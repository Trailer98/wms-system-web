<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>入库单查询</h2>
        <p>查询已创建的入库单，并对未收货的单据执行收货入库。</p>
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
      empty-text="暂无入库单数据"
      @pagination-change="fetchOrders"
    >
      <template #orderNo="{ row }">
        <router-link :to="`/inbound-orders/${row.id}`" class="order-link">{{ row.orderNo }}</router-link>
      </template>
      <template #status="{ row }">
        <el-tag :type="row.status === 'RECEIVED' ? 'success' : 'warning'" effect="plain">
          {{ orderStatusLabel(row.status, 'inbound') }}
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
          @click="receiveOrder(row)"
        >
          收货
        </el-button>
        <el-button
          type="danger"
          link
          :disabled="row.status !== 'CREATED'"
          :loading="actionLoadingId === row.id"
          @click="deleteOrder(row)"
        >
          删除
        </el-button>
      </template>
    </CommonDataTable>
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
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
    label: '入库单号',
    type: 'input',
    placeholder: '请输入入库单号',
    trim: true
  },
  {
    prop: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { label: '已创建', value: 'CREATED' },
      { label: '已收货', value: 'RECEIVED' }
    ]
  }
]

const tableColumns = [
  { label: '入库单号', minWidth: 150, slot: 'orderNo' },
  { label: '状态', width: 110, slot: 'status', align: 'center' },
  { prop: 'warehouseCode', label: '仓库', minWidth: 120 },
  { prop: 'supplierName', label: '供应商', minWidth: 160, showOverflowTooltip: true },
  { label: '明细', minWidth: 260, slot: 'items', showOverflowTooltip: true },
  { label: '收货时间', minWidth: 170, formatter: (row) => formatDateTime(row.receivedAt) },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) },
  { label: '操作', width: 150, slot: 'actions', fixed: 'right', align: 'center' }
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
    const response = await axios.get('/inbound-orders', { params: buildParams() })
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

const receiveOrder = async (row) => {
  actionLoadingId.value = row.id
  try {
    const response = await axios.post(`/inbound-orders/${row.id}/receive`)
    const nextOrder = unwrapApiData(response)
    orders.value = orders.value.map((item) => (item.id === row.id ? nextOrder : item))
    ElMessage.success('入库单收货成功')
  } finally {
    actionLoadingId.value = null
  }
}

const deleteOrder = async (row) => {
  const confirmed = await ElMessageBox.confirm(`确认删除入库单「${row.orderNo}」吗？`, '提示', { type: 'warning' })
    .then(() => true)
    .catch(() => false)
  if (!confirmed) return

  actionLoadingId.value = row.id
  try {
    await axios.delete(`/inbound-orders/${row.id}`)
    orders.value = orders.value.filter((item) => item.id !== row.id)
    pagination.total = Math.max(pagination.total - 1, 0)
    ElMessage.success('入库单已删除')
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

<style scoped>
.order-link {
  color: #2563eb;
  text-decoration: none;
}

.order-link:hover {
  text-decoration: underline;
}
</style>
