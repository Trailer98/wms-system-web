<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>{{ isEditMode ? '入库单详情' : '入库作业' }}</h2>
        <p v-if="!isEditMode">创建入库单，创建后请前往「入库单查询」页面执行收货入库。</p>
        <p v-else>查看并编辑入库单明细，保存后请前往「入库单查询」页面执行收货入库。</p>
      </div>
      <div v-if="isEditMode" class="header-actions">
        <el-button type="danger" :disabled="!isEditable" :loading="deleting" @click="deleteOrder">删除</el-button>
        <el-button @click="goToQuery">返回查询</el-button>
      </div>
    </div>

    <el-alert
      v-if="isEditMode && !isEditable"
      class="edit-alert"
      type="warning"
      :closable="false"
      :title="`该入库单当前状态为「${orderStatusLabel(currentOrder?.status, 'inbound')}」，已不可编辑`"
    />

    <el-form class="order-form" ref="orderFormRef" :model="orderForm" :rules="orderRules" label-width="90px" :disabled="isReadOnly">
      <el-row :gutter="16">
        <el-col :xs="24" :md="8">
          <el-form-item label="入库单号" prop="orderNo">
            <el-input v-model.trim="orderForm.orderNo" maxlength="64" show-word-limit placeholder="请输入入库单号" :disabled="isEditMode" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="8">
          <el-form-item label="仓库" prop="warehouseId">
            <el-select v-model="orderForm.warehouseId" filterable placeholder="请选择仓库" :disabled="isEditMode" @change="handleWarehouseChange">
              <el-option
                v-for="warehouse in warehouses"
                :key="warehouse.id"
                :label="`${warehouse.code} - ${warehouse.name}`"
                :value="warehouse.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="8">
          <el-form-item label="供应商" prop="supplierId">
            <el-select v-model="orderForm.supplierId" filterable clearable placeholder="请选择供应商" :disabled="isReadOnly">
              <el-option
                v-for="supplier in suppliers"
                :key="supplier.id"
                :label="`${supplier.code} - ${supplier.name}`"
                :value="supplier.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <div class="items-header">
        <h3>明细</h3>
        <el-button :disabled="!orderForm.warehouseId || isReadOnly" @click="addItem">新增明细</el-button>
      </div>

      <el-table :data="orderForm.items" border class="order-items-table">
        <el-table-column label="SKU" min-width="220">
          <template #default="{ row }">
            <el-select v-model="row.skuId" filterable placeholder="请选择 SKU" :disabled="isReadOnly">
              <el-option
                v-for="sku in skus"
                :key="sku.id"
                :label="`${sku.code} - ${sku.name}`"
                :value="sku.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="数量" width="160">
          <template #default="{ row }">
            <el-input-number v-model="row.quantity" :min="1" :precision="0" controls-position="right" :disabled="isReadOnly" />
          </template>
        </el-table-column>
        <el-table-column label="目标库区" min-width="200">
          <template #default="{ row }">
            <el-select
              v-model="row.areaId"
              filterable
              placeholder="目标库区"
              :disabled="!areaOptions.length || isReadOnly"
              @change="() => handleItemAreaChange(row)"
            >
              <el-option
                v-for="area in areaOptions"
                :key="area.id"
                :label="`${area.areaCode} - ${area.areaName}`"
                :value="area.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="目标库位" min-width="200">
          <template #default="{ row }">
            <el-select
              v-model="row.locationId"
              filterable
              placeholder="目标库位"
              :disabled="!row.locationOptions.length || isReadOnly"
            >
              <el-option
                v-for="location in row.locationOptions"
                :key="location.id"
                :label="location.locationCode"
                :value="location.id"
              />
            </el-select>
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
          {{ isEditMode ? '保存修改' : '创建入库单' }}
        </el-button>
      </div>
    </el-form>

    <div v-if="!isEditMode" class="result-section">
      <div class="section-title">
        <h3>本次创建的入库单</h3>
      </div>
      <CommonDataTable
        :data="orders"
        :columns="tableColumns"
        :show-pagination="false"
        empty-text="暂无已创建入库单"
      >
        <template #status="{ row }">
          <el-tag :type="row.status === 'RECEIVED' ? 'success' : 'warning'" effect="plain">
            {{ orderStatusLabel(row.status, 'inbound') }}
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
import CommonDataTable from '../components/common/CommonDataTable.vue'
import { formatDateTime, normalizePageResponse, orderStatusLabel, unwrapApiData } from '../utils/apiResponse'

const axios = inject('$axios')
const route = useRoute()
const router = useRouter()
const saving = ref(false)
const deleting = ref(false)
const warehouses = ref([])
const skus = ref([])
const suppliers = ref([])
const orders = ref([])
const orderFormRef = ref()
const areaOptions = ref([])
const currentOrder = ref(null)

const isEditMode = computed(() => !!route.params.id)
const isEditable = computed(() => currentOrder.value?.status === 'CREATED')
const isReadOnly = computed(() => isEditMode.value && !isEditable.value)

const initialItem = () => ({
  skuId: '',
  quantity: 1,
  areaId: '',
  locationId: '',
  locationOptions: []
})

const orderForm = reactive({
  orderNo: '',
  warehouseId: '',
  supplierId: '',
  items: [initialItem()]
})

const orderRules = {
  orderNo: [{ required: true, message: '请输入入库单号', trigger: 'blur' }],
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }]
}

const tableColumns = [
  { prop: 'orderNo', label: '入库单号', minWidth: 150 },
  { label: '状态', width: 110, slot: 'status', align: 'center' },
  { prop: 'warehouseCode', label: '仓库', minWidth: 120 },
  { prop: 'supplierName', label: '供应商', minWidth: 160, showOverflowTooltip: true },
  { label: '明细', minWidth: 260, slot: 'items', showOverflowTooltip: true },
  { label: '收货时间', minWidth: 170, formatter: (row) => formatDateTime(row.receivedAt) },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) }
]

const fetchOptions = async () => {
  const [warehouseResponse, skuResponse, supplierResponse] = await Promise.all([
    axios.get('/warehouses', { params: { pageNum: 1, pageSize: 100 } }),
    axios.get('/skus', { params: { pageNum: 1, pageSize: 100 } }),
    axios.get('/suppliers', { params: { pageNum: 1, pageSize: 100 } })
  ])
  warehouses.value = normalizePageResponse(warehouseResponse).rows
  skus.value = normalizePageResponse(skuResponse).rows
  suppliers.value = normalizePageResponse(supplierResponse).rows
}

const loadUsableAreas = async (warehouseId) => {
  if (!warehouseId) return []
  const response = await axios.get(`/warehouse-areas/by-warehouse/${warehouseId}`)
  const data = unwrapApiData(response)
  return (Array.isArray(data) ? data : []).filter((area) => area.status === 'ENABLED')
}

const loadUsableLocations = async (areaId) => {
  if (!areaId) return []
  const response = await axios.get(`/warehouse-locations/by-area/${areaId}`)
  const data = unwrapApiData(response)
  return (Array.isArray(data) ? data : []).filter((location) => location.status === 'ENABLED')
}

const ensureOptionPresent = (list, id, syntheticEntry) => {
  if (!id || list.some((option) => option.id === id)) return list
  return [...list, syntheticEntry]
}

const handleWarehouseChange = async () => {
  orderForm.items = [initialItem()]
  areaOptions.value = await loadUsableAreas(orderForm.warehouseId)
}

const handleItemAreaChange = async (item) => {
  item.locationId = ''
  item.locationOptions = await loadUsableLocations(item.areaId)
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
  orderForm.supplierId = ''
  orderForm.items = [initialItem()]
  areaOptions.value = []
  orderFormRef.value?.clearValidate()
}

const validateItems = () => {
  if (!orderForm.items.length) {
    ElMessage.warning('请至少添加一条入库明细')
    return false
  }

  const invalid = orderForm.items.some((item) => !item.skuId || !item.quantity || item.quantity < 1 || !item.areaId || !item.locationId)
  if (invalid) {
    ElMessage.warning('请完整填写 SKU、数量、目标库区和库位')
    return false
  }

  return true
}

const buildItemsPayload = () => orderForm.items.map((item) => ({
  skuId: item.skuId,
  quantity: item.quantity,
  areaId: item.areaId,
  locationId: item.locationId
}))

const submitOrder = async () => {
  const valid = await orderFormRef.value?.validate().catch(() => false)
  if (!valid || !validateItems()) return

  saving.value = true
  try {
    if (isEditMode.value) {
      const response = await axios.put(`/inbound-orders/${route.params.id}`, {
        supplierId: orderForm.supplierId || null,
        items: buildItemsPayload()
      })
      currentOrder.value = unwrapApiData(response)
      ElMessage.success('入库单保存成功')
    } else {
      const response = await axios.post('/inbound-orders', {
        orderNo: orderForm.orderNo,
        warehouseId: orderForm.warehouseId,
        supplierId: orderForm.supplierId || null,
        items: buildItemsPayload()
      })
      const order = unwrapApiData(response)
      orders.value = [order, ...orders.value]
      ElMessage.success('入库单创建成功')
      resetForm()
    }
  } finally {
    saving.value = false
  }
}

const loadOrderForEdit = async (id) => {
  const response = await axios.get(`/inbound-orders/${id}`)
  const order = unwrapApiData(response)
  currentOrder.value = order

  orderForm.orderNo = order.orderNo
  orderForm.warehouseId = order.warehouseId
  orderForm.supplierId = order.supplierId || ''

  areaOptions.value = await loadUsableAreas(order.warehouseId)

  orderForm.items = []
  for (const item of order.items) {
    const locationOptions = ensureOptionPresent(
      await loadUsableLocations(item.areaId),
      item.locationId,
      { id: item.locationId, locationCode: item.locationCode }
    )
    areaOptions.value = ensureOptionPresent(areaOptions.value, item.areaId, { id: item.areaId, areaCode: item.areaCode, areaName: '' })
    orderForm.items.push({
      skuId: item.skuId,
      quantity: item.quantity,
      areaId: item.areaId,
      locationId: item.locationId,
      locationOptions
    })
  }
}

const goToQuery = () => {
  router.push('/inbound-orders/query')
}

const deleteOrder = async () => {
  const confirmed = await ElMessageBox.confirm(`确认删除入库单「${orderForm.orderNo}」吗？`, '提示', { type: 'warning' })
    .then(() => true)
    .catch(() => false)
  if (!confirmed) return

  deleting.value = true
  try {
    await axios.delete(`/inbound-orders/${route.params.id}`)
    ElMessage.success('入库单已删除')
    goToQuery()
  } finally {
    deleting.value = false
  }
}

const formatItems = (items = []) => {
  if (!items.length) return '-'
  return items.map((item) => `${item.skuCode || item.skuId} x ${item.quantity}${item.locationCode ? ` @ ${item.locationCode}` : ''}`).join('；')
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
