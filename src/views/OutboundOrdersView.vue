<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>出库作业</h2>
        <p>创建出库单，创建后请前往「出库单查询」页面执行发货扣减库存。</p>
      </div>
    </div>

    <el-form class="order-form" ref="orderFormRef" :model="orderForm" :rules="orderRules" label-width="90px">
      <el-row :gutter="16">
        <el-col :xs="24" :md="8">
          <el-form-item label="出库单号" prop="orderNo">
            <el-input v-model.trim="orderForm.orderNo" maxlength="64" show-word-limit placeholder="请输入出库单号" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="8">
          <el-form-item label="仓库" prop="warehouseId">
            <el-select
              v-model="orderForm.warehouseId"
              filterable
              placeholder="请选择仓库"
              @change="handleWarehouseChange"
            >
              <el-option
                v-for="warehouse in warehouseOptions"
                :key="warehouse.id"
                :label="`${warehouse.code} - ${warehouse.name}`"
                :value="warehouse.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="8">
          <el-form-item label="客户" prop="customerName">
            <el-input v-model.trim="orderForm.customerName" maxlength="128" show-word-limit placeholder="请输入客户名称" />
          </el-form-item>
        </el-col>
      </el-row>

      <div class="items-header">
        <h3>明细</h3>
        <el-button :disabled="!skuOptions.length" @click="addItem">新增明细</el-button>
      </div>

      <div class="order-items">
        <div v-for="(item, index) in orderForm.items" :key="index" class="order-item-row">
          <el-select
            v-model="item.skuId"
            filterable
            placeholder="请选择 SKU"
            :disabled="!orderForm.warehouseId"
            @change="handleSkuChange(item)"
          >
            <el-option
              v-for="sku in skuOptions"
              :key="sku.id"
              :label="`${sku.code} - ${sku.name}（可用 ${sku.availableQuantity}）`"
              :value="sku.id"
            />
          </el-select>
          <el-input-number
            v-model="item.quantity"
            :min="1"
            :max="itemMaxQuantity(item)"
            :precision="0"
            controls-position="right"
          />
          <el-button :disabled="orderForm.items.length === 1" @click="removeItem(index)">删除</el-button>
        </div>
      </div>

      <div class="form-actions">
        <el-button @click="resetForm">重置</el-button>
        <el-button type="primary" :loading="saving" @click="submitOrder">创建出库单</el-button>
      </div>
    </el-form>

    <div class="result-section">
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
import { ElMessage } from 'element-plus'
import { computed, inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import { formatDateTime, normalizePageResponse, orderStatusLabel, unwrapApiData } from '../utils/apiResponse'

const axios = inject('$axios')
const saving = ref(false)
const inventoryRecords = ref([])
const skuOptions = ref([])
const orders = ref([])
const orderFormRef = ref()

const initialItem = () => ({
  skuId: '',
  quantity: 1
})

const orderForm = reactive({
  orderNo: '',
  warehouseId: '',
  customerName: '',
  items: [initialItem()]
})

const orderRules = {
  orderNo: [{ required: true, message: '请输入出库单号', trigger: 'blur' }],
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

const fetchOptions = async () => {
  const response = await axios.get('/inventory', { params: { pageNum: 1, pageSize: 100 } })
  inventoryRecords.value = normalizePageResponse(response).rows.filter((record) => record.availableQuantity > 0)
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
  orderForm.customerName = ''
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

const submitOrder = async () => {
  const valid = await orderFormRef.value?.validate().catch(() => false)
  if (!valid || !validateItems()) return

  saving.value = true
  try {
    const response = await axios.post('/outbound-orders', {
      orderNo: orderForm.orderNo,
      warehouseId: orderForm.warehouseId,
      customerName: orderForm.customerName,
      items: orderForm.items.map((item) => ({
        skuId: item.skuId,
        quantity: item.quantity
      }))
    })
    const order = unwrapApiData(response)
    orders.value = [order, ...orders.value]
    ElMessage.success('出库单创建成功')
    resetForm()
  } finally {
    saving.value = false
  }
}

const formatItems = (items = []) => {
  if (!items.length) return '-'
  return items.map((item) => `${item.skuCode || item.skuId} x ${item.quantity}`).join('；')
}

onMounted(fetchOptions)
</script>
