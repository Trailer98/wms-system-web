<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>库存盘点</h2>
        <p>核对账面库存与实际库存，开始盘点后涉及库位会被锁定，完成后自动生成盘盈/盘亏流水。</p>
      </div>
      <el-button v-if="authStore.hasPermission('stock-count:create')" type="primary" @click="openCreateDialog">新增盘点任务</el-button>
    </div>

    <CommonQueryForm
      :model="queryForm"
      :fields="queryFields"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <CommonDataTable
      :data="tasks"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无库存盘点任务数据"
      @pagination-change="fetchTasks"
    >
      <template #status="{ row }">
        <el-tag :type="statusTagType(row.status)" effect="plain">{{ statusLabel(row.status) }}</el-tag>
      </template>
      <template #actions="{ row }">
        <el-button type="primary" link @click="openDetail(row)">详情</el-button>
        <el-button v-if="row.status === 'DRAFT' && authStore.hasPermission('stock-count:start')" type="success" link :loading="actionLoadingId === row.id" @click="startTask(row)">开始盘点</el-button>
        <el-button v-if="row.status === 'COUNTING' && authStore.hasPermission('stock-count:record')" type="primary" link @click="openRecordDialog(row)">录入实盘</el-button>
        <el-button v-if="row.status === 'COUNTING' && authStore.hasPermission('stock-count:complete')" type="success" link :loading="actionLoadingId === row.id" @click="completeTask(row)">完成盘点</el-button>
        <el-button v-if="(row.status === 'DRAFT' || row.status === 'COUNTING') && authStore.hasPermission('stock-count:cancel')" type="danger" link :loading="actionLoadingId === row.id" @click="cancelTask(row)">取消</el-button>
      </template>
    </CommonDataTable>

    <el-dialog v-model="createDialogVisible" title="新增库存盘点任务" width="520px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="90px">
        <el-form-item label="盘点单号" prop="countNo">
          <el-input v-model.trim="createForm.countNo" maxlength="64" show-word-limit placeholder="保存时由系统自动生成" disabled />
        </el-form-item>
        <el-form-item label="仓库" prop="warehouseId">
          <el-select v-model="createForm.warehouseId" filterable placeholder="请选择仓库" @change="handleWarehouseChange">
            <el-option v-for="warehouse in warehouses" :key="warehouse.id" :label="`${warehouse.code} - ${warehouse.name}`" :value="warehouse.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="库区">
          <el-select v-model="createForm.areaId" filterable clearable placeholder="不选则盘点整个仓库" :disabled="!areaOptions.length" @change="handleAreaChange">
            <el-option v-for="area in areaOptions" :key="area.id" :label="`${area.areaCode} - ${area.areaName}`" :value="area.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="库位">
          <el-select v-model="createForm.locationId" filterable clearable placeholder="不选则盘点整个库区" :disabled="!locationOptions.length">
            <el-option v-for="location in locationOptions" :key="location.id" :label="location.locationCode" :value="location.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model.trim="createForm.remark" maxlength="255" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="recordDialogVisible" title="录入实盘数量" width="820px">
      <el-table :data="recordItems" border>
        <el-table-column label="SKU" min-width="160" :formatter="(row) => `${row.skuCode || ''} ${row.skuName || ''}`.trim() || '-'" />
        <el-table-column prop="areaCode" label="库区" width="100" />
        <el-table-column prop="locationCode" label="库位" width="100" />
        <el-table-column prop="bookOnHandQty" label="账面现存量" width="110" align="right" />
        <el-table-column label="实盘数量" width="160">
          <template #default="{ row }">
            <el-input-number v-model="row.actualQty" :min="0" :precision="0" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="140">
          <template #default="{ row }">
            <el-input v-model.trim="row.remark" maxlength="255" placeholder="备注" />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="recordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitRecord">保存实盘数据</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="库存盘点任务详情" width="900px">
      <el-descriptions v-if="activeTask" :column="2" border>
        <el-descriptions-item label="盘点单号">{{ activeTask.countNo }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusLabel(activeTask.status) }}</el-descriptions-item>
        <el-descriptions-item label="仓库">{{ activeTask.warehouseCode }}</el-descriptions-item>
        <el-descriptions-item label="范围">{{ activeTask.areaCode || '全仓库' }}{{ activeTask.locationCode ? ' / ' + activeTask.locationCode : '' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ activeTask.remark || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ activeTask.createdBy || '-' }}</el-descriptions-item>
        <el-descriptions-item label="完成人">{{ activeTask.completedBy || '-' }}</el-descriptions-item>
      </el-descriptions>
      <CommonDataTable
        class="detail-items-table"
        :data="activeTask?.items || []"
        :columns="detailColumns"
        :show-pagination="false"
        empty-text="暂无明细"
      >
        <template #diffQty="{ row }">
          <el-tag v-if="row.diffQty > 0" type="success" effect="plain">盘盈 +{{ row.diffQty }}</el-tag>
          <el-tag v-else-if="row.diffQty < 0" type="danger" effect="plain">盘亏 {{ row.diffQty }}</el-tag>
          <span v-else-if="row.diffQty === 0">无差异</span>
          <span v-else>-</span>
        </template>
      </CommonDataTable>
    </el-dialog>
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import CommonQueryForm from '../components/common/CommonQueryForm.vue'
import { useAuthStore } from '../stores/auth'
import { formatDateTime, normalizePageResponse, unwrapApiData } from '../utils/apiResponse'

const axios = inject('$axios')
const authStore = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const actionLoadingId = ref(null)
const tasks = ref([])
const warehouses = ref([])
const areaOptions = ref([])
const locationOptions = ref([])
const createDialogVisible = ref(false)
const recordDialogVisible = ref(false)
const detailVisible = ref(false)
const activeTask = ref(null)
const activeTaskId = ref(null)
const recordItems = ref([])
const createFormRef = ref()

const queryForm = reactive({
  countNo: '',
  status: ''
})

const pagination = reactive({ pageNum: 1, pageSize: 10, total: 0 })

const statusOptions = [
  { label: '草稿', value: 'DRAFT' },
  { label: '盘点中', value: 'COUNTING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' }
]

const queryFields = [
  { prop: 'countNo', label: '盘点单号', type: 'input', placeholder: '请输入盘点单号', trim: true },
  { prop: 'status', label: '状态', type: 'select', placeholder: '请选择状态', options: statusOptions }
]

const tableColumns = [
  { prop: 'countNo', label: '盘点单号', minWidth: 160 },
  { prop: 'warehouseCode', label: '仓库', width: 110 },
  { prop: 'areaCode', label: '库区', width: 100, formatter: (row) => row.areaCode || '全仓库' },
  { prop: 'locationCode', label: '库位', width: 100, formatter: (row) => row.locationCode || '-' },
  { label: '状态', width: 100, slot: 'status', align: 'center' },
  { prop: 'createdBy', label: '创建人', width: 100 },
  { label: '创建时间', minWidth: 160, formatter: (row) => formatDateTime(row.createdAt) },
  { label: '完成时间', minWidth: 160, formatter: (row) => formatDateTime(row.completedAt) },
  { label: '操作', width: 280, slot: 'actions', fixed: 'right', align: 'center' }
]

const detailColumns = [
  { prop: 'skuCode', label: 'SKU', minWidth: 130, formatter: (row) => `${row.skuCode || ''} ${row.skuName || ''}`.trim() || '-' },
  { prop: 'areaCode', label: '库区', width: 90 },
  { prop: 'locationCode', label: '库位', width: 90 },
  { prop: 'bookOnHandQty', label: '账面现存量', width: 100, align: 'right' },
  { prop: 'actualQty', label: '实盘数量', width: 90, align: 'right', formatter: (row) => row.actualQty ?? '-' },
  { label: '差异', width: 130, slot: 'diffQty', align: 'center' },
  { prop: 'remark', label: '备注', minWidth: 120, showOverflowTooltip: true }
]

const statusLabel = (value) => statusOptions.find((option) => option.value === value)?.label || value || '-'
const statusTagType = (status) => {
  if (status === 'COMPLETED') return 'success'
  if (status === 'CANCELLED') return 'info'
  if (status === 'COUNTING') return 'warning'
  return 'primary'
}

const createForm = reactive({
  countNo: '',
  warehouseId: '',
  areaId: '',
  locationId: '',
  remark: ''
})

const createRules = {
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }]
}

const fetchWarehouses = async () => {
  const response = await axios.get('/warehouses', { params: { pageNum: 1, pageSize: 100 } })
  warehouses.value = normalizePageResponse(response).rows
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

const handleWarehouseChange = async () => {
  createForm.areaId = ''
  createForm.locationId = ''
  locationOptions.value = []
  areaOptions.value = await loadUsableAreas(createForm.warehouseId)
}

const handleAreaChange = async () => {
  createForm.locationId = ''
  locationOptions.value = await loadUsableLocations(createForm.areaId)
}

const buildParams = () => {
  const params = { pageNum: pagination.pageNum, pageSize: pagination.pageSize }
  if (queryForm.countNo) params.countNo = queryForm.countNo
  if (queryForm.status) params.status = queryForm.status
  return params
}

const fetchTasks = async () => {
  loading.value = true
  try {
    const response = await axios.get('/stock-count-tasks/page', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    tasks.value = rows
    pagination.total = total
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchTasks()
}

const handleReset = () => {
  queryForm.countNo = ''
  queryForm.status = ''
  pagination.pageNum = 1
  fetchTasks()
}

const openCreateDialog = () => {
  createForm.countNo = ''
  createForm.warehouseId = ''
  createForm.areaId = ''
  createForm.locationId = ''
  createForm.remark = ''
  areaOptions.value = []
  locationOptions.value = []
  createFormRef.value?.clearValidate()
  createDialogVisible.value = true
}

const submitCreate = async () => {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const response = await axios.post('/stock-count-tasks', {
      warehouseId: createForm.warehouseId,
      areaId: createForm.areaId || null,
      locationId: createForm.locationId || null,
      remark: createForm.remark || null
    })
    const task = unwrapApiData(response)
    ElMessage.success(`创建成功，盘点单号：${task.countNo}`)
    createDialogVisible.value = false
    pagination.pageNum = 1
    await fetchTasks()
  } finally {
    saving.value = false
  }
}

const startTask = async (row) => {
  const confirmed = await ElMessageBox.confirm(`确认开始盘点任务「${row.countNo}」吗？涉及库位在盘点期间将无法入库、出库锁库或库存调整。`, '提示', { type: 'warning' })
    .then(() => true).catch(() => false)
  if (!confirmed) return

  actionLoadingId.value = row.id
  try {
    await axios.post(`/stock-count-tasks/${row.id}/start`)
    ElMessage.success('盘点已开始')
    await fetchTasks()
  } finally {
    actionLoadingId.value = null
  }
}

const openRecordDialog = async (row) => {
  const response = await axios.get(`/stock-count-tasks/${row.id}`)
  const task = unwrapApiData(response)
  activeTaskId.value = task.id
  recordItems.value = task.items.map((item) => ({ ...item, actualQty: item.actualQty ?? item.bookOnHandQty, remark: item.remark || '' }))
  recordDialogVisible.value = true
}

const submitRecord = async () => {
  saving.value = true
  try {
    await axios.put(`/stock-count-tasks/${activeTaskId.value}/items`, {
      items: recordItems.value.map((item) => ({ itemId: item.id, actualQty: item.actualQty, remark: item.remark || null }))
    })
    ElMessage.success('实盘数据已保存')
    recordDialogVisible.value = false
    await fetchTasks()
  } finally {
    saving.value = false
  }
}

const completeTask = async (row) => {
  const confirmed = await ElMessageBox.confirm(`确认完成盘点任务「${row.countNo}」吗？系统将按差异生成盘盈/盘亏并更新库存。`, '提示', { type: 'warning' })
    .then(() => true).catch(() => false)
  if (!confirmed) return

  actionLoadingId.value = row.id
  try {
    await axios.post(`/stock-count-tasks/${row.id}/complete`)
    ElMessage.success('盘点已完成')
    await fetchTasks()
  } finally {
    actionLoadingId.value = null
  }
}

const cancelTask = async (row) => {
  const confirmed = await ElMessageBox.confirm(`确认取消盘点任务「${row.countNo}」吗？`, '提示', { type: 'warning' })
    .then(() => true).catch(() => false)
  if (!confirmed) return

  actionLoadingId.value = row.id
  try {
    await axios.post(`/stock-count-tasks/${row.id}/cancel`, {})
    ElMessage.success('盘点任务已取消')
    await fetchTasks()
  } finally {
    actionLoadingId.value = null
  }
}

const openDetail = async (row) => {
  const response = await axios.get(`/stock-count-tasks/${row.id}`)
  activeTask.value = unwrapApiData(response)
  detailVisible.value = true
}

onMounted(async () => {
  await fetchWarehouses()
  await fetchTasks()
})
</script>

<style scoped>
.detail-items-table {
  margin-top: 16px;
}
</style>
