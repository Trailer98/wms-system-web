<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>出库单查询</h2>
        <p>查询已创建的出库单，锁定库存、确认发货或取消出库单。</p>
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
      <template #orderNo="{ row }">
        <router-link :to="`/outbound-orders/${row.id}`" class="order-link">{{ row.orderNo }}</router-link>
      </template>
      <template #status="{ row }">
        <el-tag :type="statusTagType(row.status)" effect="plain">
          {{ orderStatusLabel(row.status, 'outbound') }}
        </el-tag>
      </template>
      <template #items="{ row }">
        <span>{{ formatItems(row.items) }}</span>
      </template>
      <template #actions="{ row }">
        <el-button type="primary" link @click="openAllocationDialog(row)">分配明细</el-button>
        <el-button
          v-if="row.status === 'CREATED' && authStore.hasPermission('outbound:lock')"
          type="primary"
          link
          :loading="actionLoadingId === row.id"
          @click="lockOrder(row)"
        >
          锁定库存
        </el-button>
        <el-button
          v-if="row.status === 'LOCKED' && authStore.hasPermission('outbound:confirm')"
          type="success"
          link
          :loading="actionLoadingId === row.id"
          @click="shipOrder(row)"
        >
          确认发货
        </el-button>
        <el-button
          v-if="(row.status === 'CREATED' || row.status === 'LOCKED') && authStore.hasPermission('outbound:cancel')"
          type="danger"
          link
          :loading="actionLoadingId === row.id"
          @click="cancelOrder(row)"
        >
          取消
        </el-button>
        <el-button
          v-if="row.status !== 'SHIPPED' && authStore.hasPermission('outbound:cancel')"
          type="danger"
          link
          :loading="actionLoadingId === row.id"
          @click="deleteOrder(row)"
        >
          删除
        </el-button>
      </template>
    </CommonDataTable>

    <el-dialog v-model="allocationDialogVisible" title="库存分配明细" width="720px">
      <CommonDataTable
        :data="activeAllocations"
        :columns="allocationColumns"
        :show-pagination="false"
        empty-text="该出库单尚未分配库位"
      >
        <template #status="{ row }">
          <el-tag effect="plain">{{ lockStatusLabel(row.status) }}</el-tag>
        </template>
      </CommonDataTable>
    </el-dialog>
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../../components/common/CommonDataTable.vue'
import CommonQueryForm from '../../components/common/CommonQueryForm.vue'
import { usePagination } from '../../composables/usePagination.js'
import { useAuthStore } from '../../stores/auth.js'
import { formatDateTime, normalizePageResponse, orderStatusLabel, unwrapApiData } from '../../utils/apiResponse.js'

const axios = inject('$axios')
const authStore = useAuthStore()
const loading = ref(false)
const actionLoadingId = ref(null)
const orders = ref([])
const allocationDialogVisible = ref(false)
const activeAllocations = ref([])

const queryForm = reactive({
  orderNo: '',
  status: ''
})

const { pagination, resetToFirstPage, adjustPageAfterRemoval } = usePagination()

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
      { label: '已锁库', value: 'LOCKED' },
      { label: '已发货', value: 'SHIPPED' },
      { label: '已取消', value: 'CANCELLED' }
    ]
  }
]

const tableColumns = [
  { label: '出库单号', minWidth: 150, slot: 'orderNo' },
  { label: '状态', width: 100, slot: 'status', align: 'center' },
  { prop: 'warehouseCode', label: '仓库', minWidth: 120 },
  { prop: 'customerName', label: '客户', minWidth: 160, showOverflowTooltip: true },
  { label: '明细', minWidth: 220, slot: 'items', showOverflowTooltip: true },
  { label: '发货时间', minWidth: 170, formatter: (row) => formatDateTime(row.shippedAt) },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) },
  { label: '操作', width: 280, slot: 'actions', fixed: 'right', align: 'center' }
]

const allocationColumns = [
  { prop: 'skuCode', label: 'SKU', minWidth: 130, formatter: (row) => `${row.skuCode || ''} ${row.skuName || ''}`.trim() || '-' },
  { prop: 'warehouseCode', label: '仓库', minWidth: 100 },
  { prop: 'areaCode', label: '库区', minWidth: 90 },
  { prop: 'locationCode', label: '库位', minWidth: 90 },
  { prop: 'lockQty', label: '锁定数量', width: 90, align: 'right' },
  { prop: 'shippedQty', label: '已出库数量', width: 100, align: 'right' },
  { label: '状态', width: 100, slot: 'status', align: 'center' }
]

const lockStatusLabels = {
  LOCKED: '已锁定',
  RELEASED: '已释放',
  SHIPPED: '已出库'
}
const lockStatusLabel = (value) => lockStatusLabels[value] || value || '-'

const statusTagType = (status) => {
  if (status === 'SHIPPED') return 'success'
  if (status === 'CANCELLED') return 'info'
  if (status === 'LOCKED') return 'warning'
  return 'primary'
}

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
  resetToFirstPage()
  fetchOrders()
}

const handleReset = () => {
  queryForm.orderNo = ''
  queryForm.status = ''
  resetToFirstPage()
  fetchOrders()
}

const replaceOrder = (nextOrder) => {
  orders.value = orders.value.map((item) => (item.id === nextOrder.id ? nextOrder : item))
}

const lockOrder = async (row) => {
  actionLoadingId.value = row.id
  try {
    const response = await axios.post(`/outbound-orders/${row.id}/lock`)
    replaceOrder(unwrapApiData(response))
    ElMessage.success('库存锁定成功')
  } finally {
    actionLoadingId.value = null
  }
}

const shipOrder = async (row) => {
  actionLoadingId.value = row.id
  try {
    const response = await axios.post(`/outbound-orders/${row.id}/ship`)
    replaceOrder(unwrapApiData(response))
    ElMessage.success('出库单发货成功')
  } finally {
    actionLoadingId.value = null
  }
}

const cancelOrder = async (row) => {
  const confirmed = await ElMessageBox.confirm(`确认取消出库单「${row.orderNo}」吗？`, '提示', { type: 'warning' })
    .then(() => true)
    .catch(() => false)
  if (!confirmed) return

  actionLoadingId.value = row.id
  try {
    const response = await axios.post(`/outbound-orders/${row.id}/cancel`)
    replaceOrder(unwrapApiData(response))
    ElMessage.success('出库单已取消')
  } finally {
    actionLoadingId.value = null
  }
}

const deleteOrder = async (row) => {
  const confirmed = await ElMessageBox.confirm(`确认删除出库单「${row.orderNo}」吗？${row.status === 'LOCKED' ? '已锁定的库存将会释放。' : ''}`, '提示', { type: 'warning' })
    .then(() => true)
    .catch(() => false)
  if (!confirmed) return

  actionLoadingId.value = row.id
  try {
    await axios.delete(`/outbound-orders/${row.id}`)
    ElMessage.success('出库单已删除')
    // Refresh the current page from the server (fresh total + fills the gap with the next page's
    // first row); step back a page first if this was the only row left on a page past the first.
    adjustPageAfterRemoval(1)
    await fetchOrders()
  } finally {
    actionLoadingId.value = null
  }
}

const openAllocationDialog = (row) => {
  activeAllocations.value = row.allocations || []
  allocationDialogVisible.value = true
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
