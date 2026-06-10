<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>出库作业</h2>
        <p>创建出库单并对已创建单据执行发货扣减库存。</p>
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
            <el-select v-model="orderForm.warehouseId" filterable placeholder="请选择仓库">
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
          <el-form-item label="客户" prop="customerName">
            <el-input v-model.trim="orderForm.customerName" maxlength="128" show-word-limit placeholder="请输入客户名称" />
          </el-form-item>
        </el-col>
      </el-row>

      <div class="items-header">
        <h3>明细</h3>
        <el-button @click="addItem">新增明细</el-button>
      </div>

      <div class="order-items">
        <div v-for="(item, index) in orderForm.items" :key="index" class="order-item-row">
          <el-select v-model="item.skuId" filterable placeholder="请选择 SKU">
            <el-option
              v-for="sku in skus"
              :key="sku.id"
              :label="`${sku.code} - ${sku.name}`"
              :value="sku.id"
            />
          </el-select>
          <el-input-number v-model="item.quantity" :min="1" :precision="0" controls-position="right" />
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
    </div>
  </section>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import { formatDateTime, normalizePageResponse, orderStatusLabel, unwrapApiData } from '../utils/apiResponse'

const axios = inject('$axios')
const saving = ref(false)
const actionLoadingId = ref(null)
const warehouses = ref([])
const skus = ref([])
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
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) },
  { label: '操作', width: 100, slot: 'actions', fixed: 'right', align: 'center' }
]

const fetchOptions = async () => {
  const [warehouseResponse, skuResponse] = await Promise.all([
    axios.get('/warehouses', { params: { pageNum: 1, pageSize: 100 } }),
    axios.get('/skus', { params: { pageNum: 1, pageSize: 100 } })
  ])
  warehouses.value = normalizePageResponse(warehouseResponse).rows
  skus.value = normalizePageResponse(skuResponse).rows
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

onMounted(fetchOptions)
</script>
