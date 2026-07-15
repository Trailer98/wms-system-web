<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>{{ isEditMode ? '出库单详情' : '出库作业' }}</h2>
        <p v-if="!isEditMode">创建出库单，创建后请前往「出库单查询」页面执行发货扣减库存。</p>
        <p v-else>查看并编辑出库单明细，保存后请前往「出库单查询」页面执行锁库、发货。</p>
      </div>
      <div v-if="isEditMode" class="header-actions">
        <el-button type="danger" :disabled="!isDeletable" :loading="deleting" @click="deleteOrder">删除</el-button>
        <el-button @click="goToQuery">返回查询</el-button>
      </div>
    </div>

    <el-alert
      v-if="isEditMode && !isEditable"
      class="edit-alert"
      type="warning"
      :closable="false"
      :title="`该出库单当前状态为「${orderStatusLabel(currentOrder?.status, 'outbound')}」，已不可编辑`"
    />

    <el-form class="order-form" ref="orderFormRef" :model="orderForm" :rules="orderRules" label-width="90px" :disabled="isReadOnly">
      <el-row :gutter="16">
        <el-col :xs="24" :md="8">
          <el-form-item label="出库单号" prop="orderNo">
            <el-input v-model.trim="orderForm.orderNo" maxlength="64" show-word-limit placeholder="保存时由系统自动生成" disabled />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="8">
          <el-form-item label="仓库" prop="warehouseId">
            <el-select
              v-model="orderForm.warehouseId"
              filterable
              placeholder="请选择仓库"
              :disabled="isEditMode"
              @change="handleWarehouseChange"
            >
              <el-option
                v-for="warehouse in activeWarehouseOptions"
                :key="warehouse.id"
                :label="`${warehouse.code} - ${warehouse.name}`"
                :value="warehouse.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="8">
          <el-form-item label="客户" prop="customerId">
            <el-select v-model="orderForm.customerId" filterable clearable placeholder="请选择客户" :disabled="isReadOnly">
              <el-option
                v-for="customer in customers"
                :key="customer.id"
                :label="`${customer.code} - ${customer.name}`"
                :value="customer.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <div class="items-header">
        <h3>明细</h3>
        <el-button :disabled="!activeSkuOptions.length || isReadOnly" @click="addItem">新增明细</el-button>
      </div>

      <el-table :data="orderForm.items" border class="order-items-table">
        <el-table-column label="SKU" min-width="260">
          <template #default="{ row }">
            <el-select
              v-model="row.skuId"
              filterable
              placeholder="请选择 SKU"
              :disabled="!orderForm.warehouseId || isReadOnly"
              @change="handleSkuChange(row)"
            >
              <el-option
                v-for="sku in activeSkuOptions"
                :key="sku.id"
                :label="skuOptionLabel(sku)"
                :value="sku.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="数量" width="180">
          <template #default="{ row }">
            <el-input-number
              v-model="row.quantity"
              :min="1"
              :max="itemMaxQuantity(row)"
              :precision="0"
              controls-position="right"
              :disabled="isReadOnly"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" :disabled="orderForm.items.length === 1 || isReadOnly" @click="removeItem($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="form-actions">
        <el-button v-if="!isEditMode" @click="resetForm">重置</el-button>
        <el-button
          v-if="!isEditMode || isEditable"
          type="primary"
          :loading="saving"
          @click="submitOrder"
        >
          {{ isEditMode ? '保存修改' : '创建出库单' }}
        </el-button>
      </div>
    </el-form>

    <div v-if="!isEditMode" class="result-section">
      <div class="section-title">
        <h3>本次创建的出库单</h3>
      </div>
      <CommonDataTable
        :data="orders"
        :columns="tableColumns"
        :show-pagination="false"
        empty-text="暂无已创建出库单"
      >
        <template #status="{ row }">
          <el-tag :type="row.status === 'SHIPPED' ? 'success' : 'warning'" effect="plain">
            {{ orderStatusLabel(row.status, 'outbound') }}
          </el-tag>
        </template>
        <template #items="{ row }">
          <span>{{ formatItems(row.items) }}</span>
        </template>
      </CommonDataTable>
    </div>
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, inject, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CommonDataTable from '../../components/common/CommonDataTable.vue'
import { formatDateTime, normalizePageResponse, orderStatusLabel, unwrapApiData } from '../../utils/apiResponse.js'

const axios = inject('$axios')
const route = useRoute()
const router = useRouter()
const saving = ref(false)
const deleting = ref(false)
const inventoryRecords = ref([])
const skuOptions = ref([])
const customers = ref([])
const orders = ref([])
const orderFormRef = ref()
const currentOrder = ref(null)
const editWarehouseOption = ref(null)
const editSkuOptions = ref([])

const isEditMode = computed(() => !!route.params.id)
const isEditable = computed(() => currentOrder.value?.status === 'CREATED')
const isReadOnly = computed(() => isEditMode.value && !isEditable.value)
const isDeletable = computed(() => isEditMode.value && currentOrder.value?.status !== 'SHIPPED')

const initialItem = () => ({
  skuId: '',
  quantity: 1
})

const orderForm = reactive({
  orderNo: '',
  warehouseId: '',
  customerId: '',
  items: [initialItem()]
})

const orderRules = {
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }]
}

const tableColumns = [
  { prop: 'orderNo', label: '出库单号', minWidth: 150 },
  { label: '状态', width: 110, slot: 'status', align: 'center' },
  { prop: 'warehouseCode', label: '仓库', minWidth: 120 },
  { prop: 'customerName', label: '客户', minWidth: 160, showOverflowTooltip: true },
  { label: '明细', minWidth: 260, slot: 'items', showOverflowTooltip: true },
  { label: '发货时间', minWidth: 170, formatter: (row) => formatDateTime(row.shippedAt) },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) }
]

const warehouseOptions = computed(() => {
  const map = new Map()
  inventoryRecords.value.forEach((record) => {
    if (!map.has(record.warehouseId)) {
      map.set(record.warehouseId, {
        id: record.warehouseId,
        code: record.warehouseCode,
        name: record.warehouseName
      })
    }
  })
  return Array.from(map.values())
})

// Edit mode targets a fixed, already-existing order: the warehouse cannot be changed, and the
// SKU choices should not be constrained to "currently has available stock" the way the create
// flow is (that cap is a create-time UX nicety; the authoritative check happens at lock time).
const activeWarehouseOptions = computed(() => (isEditMode.value ? [editWarehouseOption.value].filter(Boolean) : warehouseOptions.value))
const activeSkuOptions = computed(() => (isEditMode.value ? editSkuOptions.value : skuOptions.value))

const skuOptionLabel = (sku) => (isEditMode.value ? `${sku.code} - ${sku.name}` : `${sku.code} - ${sku.name}（可用 ${sku.availableQuantity}）`)

const fetchOptions = async () => {
  const [inventoryResponse, customerResponse] = await Promise.all([
    axios.get('/inventory', { params: { pageNum: 1, pageSize: 100 } }),
    axios.get('/customers', { params: { pageNum: 1, pageSize: 100 } })
  ])
  inventoryRecords.value = normalizePageResponse(inventoryResponse).rows.filter((record) => record.availableQuantity > 0)
  customers.value = normalizePageResponse(customerResponse).rows
}

const loadSkuOptions = (warehouseId) => {
  skuOptions.value = inventoryRecords.value
    .filter((record) => record.warehouseId === warehouseId)
    .map((record) => ({
      id: record.skuId,
      code: record.skuCode,
      name: record.skuName,
      availableQuantity: record.availableQuantity
    }))
}

const itemMaxQuantity = (item) => {
  if (isEditMode.value) return undefined

  const sku = skuOptions.value.find((option) => option.id === item.skuId)
  if (!sku) return undefined

  const usedByOtherRows = orderForm.items
    .filter((other) => other !== item && other.skuId === item.skuId)
    .reduce((sum, other) => sum + (Number(other.quantity) || 0), 0)

  return Math.max(sku.availableQuantity - usedByOtherRows, 0)
}

const handleWarehouseChange = () => {
  orderForm.items = [initialItem()]
  loadSkuOptions(orderForm.warehouseId)
}

const handleSkuChange = (item) => {
  const max = itemMaxQuantity(item)
  if (max !== undefined && item.quantity > max) {
    item.quantity = max > 0 ? max : 1
  }
}

const addItem = () => {
  orderForm.items.push(initialItem())
}

const removeItem = (index) => {
  orderForm.items.splice(index, 1)
}

const resetForm = () => {
  orderForm.orderNo = ''
  orderForm.warehouseId = ''
  orderForm.customerId = ''
  orderForm.items = [initialItem()]
  skuOptions.value = []
  orderFormRef.value?.clearValidate()
}

const validateItems = () => {
  if (!orderForm.items.length) {
    ElMessage.warning('请至少添加一条出库明细')
    return false
  }

  const invalid = orderForm.items.some((item) => !item.skuId || !item.quantity || item.quantity < 1)
  if (invalid) {
    ElMessage.warning('请完整填写 SKU 和数量')
    return false
  }

  if (isEditMode.value) {
    return true
  }

  const quantityBySku = new Map()
  orderForm.items.forEach((item) => {
    quantityBySku.set(item.skuId, (quantityBySku.get(item.skuId) || 0) + Number(item.quantity))
  })

  for (const [skuId, totalQuantity] of quantityBySku) {
    const sku = skuOptions.value.find((option) => option.id === skuId)
    if (!sku || totalQuantity > sku.availableQuantity) {
      ElMessage.warning(`SKU ${sku?.code || skuId} 出库数量超过当前库存`)
      return false
    }
  }

  return true
}

const buildItemsPayload = () => orderForm.items.map((item) => ({
  skuId: item.skuId,
  quantity: item.quantity
}))

const submitOrder = async () => {
  const valid = await orderFormRef.value?.validate().catch(() => false)
  if (!valid || !validateItems()) return

  saving.value = true
  try {
    if (isEditMode.value) {
      const response = await axios.put(`/outbound-orders/${route.params.id}`, {
        customerId: orderForm.customerId || null,
        items: buildItemsPayload()
      })
      currentOrder.value = unwrapApiData(response)
      ElMessage.success('出库单保存成功')
    } else {
      const response = await axios.post('/outbound-orders', {
        warehouseId: orderForm.warehouseId,
        customerId: orderForm.customerId || null,
        items: buildItemsPayload()
      })
      const order = unwrapApiData(response)
      orders.value = [order, ...orders.value]
      ElMessage.success(`创建成功，出库单号：${order.orderNo}`)
      resetForm()
    }
  } finally {
    saving.value = false
  }
}

const loadOrderForEdit = async (id) => {
  const response = await axios.get(`/outbound-orders/${id}`)
  const order = unwrapApiData(response)
  currentOrder.value = order

  orderForm.orderNo = order.orderNo
  orderForm.warehouseId = order.warehouseId
  orderForm.customerId = order.customerId || ''
  orderForm.items = order.items.map((item) => ({ skuId: item.skuId, quantity: item.quantity }))

  const [warehouseResponse, skuResponse] = await Promise.all([
    axios.get('/warehouses', { params: { pageNum: 1, pageSize: 100 } }),
    axios.get('/skus', { params: { pageNum: 1, pageSize: 100 } })
  ])
  const warehouseList = normalizePageResponse(warehouseResponse).rows
  editWarehouseOption.value = warehouseList.find((warehouse) => warehouse.id === order.warehouseId)
    || { id: order.warehouseId, code: order.warehouseCode, name: order.warehouseCode }
  editSkuOptions.value = normalizePageResponse(skuResponse).rows.map((sku) => ({ id: sku.id, code: sku.code, name: sku.name }))
}

const goToQuery = () => {
  router.push('/outbound-orders/query')
}

const deleteOrder = async () => {
  const confirmed = await ElMessageBox.confirm(
    `确认删除出库单「${orderForm.orderNo}」吗？${currentOrder.value?.status === 'LOCKED' ? '已锁定的库存将会释放。' : ''}`,
    '提示',
    { type: 'warning' }
  ).then(() => true).catch(() => false)
  if (!confirmed) return

  deleting.value = true
  try {
    await axios.delete(`/outbound-orders/${route.params.id}`)
    ElMessage.success('出库单已删除')
    goToQuery()
  } finally {
    deleting.value = false
  }
}

const formatItems = (items = []) => {
  if (!items.length) return '-'
  return items.map((item) => `${item.skuCode || item.skuId} x ${item.quantity}`).join('；')
}

watch(() => route.params.id, (id) => {
  if (id) {
    loadOrderForEdit(id)
  }
})

onMounted(async () => {
  await fetchOptions()
  if (isEditMode.value) {
    await loadOrderForEdit(route.params.id)
  }
})
</script>

<style scoped>
.header-actions {
  display: flex;
  gap: 12px;
}

.edit-alert {
  margin-bottom: 16px;
}

.order-items-table {
  margin-top: 14px;
}

.order-items-table :deep(.el-select) {
  width: 100%;
}
</style>
