<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>入库作业</h2>
        <p>创建入库单并对已创建单据执行收货入库。</p>
      </div>
    </div>

    <el-form class="order-form" ref="orderFormRef" :model="orderForm" :rules="orderRules" label-width="90px">
      <el-row :gutter="16">
        <el-col :xs="24" :md="8">
          <el-form-item label="入库单号" prop="orderNo">
            <el-input v-model.trim="orderForm.orderNo" maxlength="64" show-word-limit placeholder="请输入入库单号" />
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
          <el-form-item label="供应商" prop="supplierName">
            <el-input v-model.trim="orderForm.supplierName" maxlength="128" show-word-limit placeholder="请输入供应商" />
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
        <el-button type="primary" :loading="saving" @click="submitOrder">创建入库单</el-button>
      </div>
    </el-form>

    <div class="result-section">
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
  supplierName: '',
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
  orderForm.supplierName = ''
  orderForm.items = [initialItem()]
  orderFormRef.value?.clearValidate()
}

const validateItems = () => {
  if (!orderForm.items.length) {
    ElMessage.warning('请至少添加一条入库明细')
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
    const response = await axios.post('/inbound-orders', {
      orderNo: orderForm.orderNo,
      warehouseId: orderForm.warehouseId,
      supplierName: orderForm.supplierName,
      items: orderForm.items.map((item) => ({
        skuId: item.skuId,
        quantity: item.quantity
      }))
    })
    const order = unwrapApiData(response)
    orders.value = [order, ...orders.value]
    ElMessage.success('入库单创建成功')
    resetForm()
  } finally {
    saving.value = false
  }
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

const formatItems = (items = []) => {
  if (!items.length) return '-'
  return items.map((item) => `${item.skuCode || item.skuId} x ${item.quantity}`).join('；')
}

onMounted(fetchOptions)
</script>
