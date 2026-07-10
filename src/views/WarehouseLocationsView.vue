<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>库位管理</h2>
        <p>维护仓库、库区下的库位信息，支持容量、混放规则与状态管理。</p>
      </div>
      <el-button type="primary" :disabled="!warehouseOptions.length" @click="openCreateDialog">新增库位</el-button>
    </div>

    <CommonQueryForm
      :model="queryForm"
      :fields="queryFields"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <CommonDataTable
      :data="locations"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无库位数据"
      @pagination-change="fetchLocations"
    >
      <template #status="{ row }">
        <el-tag :type="statusTagType(row.status)" effect="plain">{{ locationStatusLabel(row.status) }}</el-tag>
      </template>
      <template #allowMixedSku="{ row }">
        <el-tag :type="row.allowMixedSku ? 'success' : 'info'" effect="plain">{{ row.allowMixedSku ? '允许' : '不允许' }}</el-tag>
      </template>
      <template #capacity="{ row }">{{ row.usedQty }} / {{ row.capacityQty }}</template>
      <template #actions="{ row }">
        <el-button type="primary" link @click="openEditDialog(row)">编辑</el-button>
        <el-dropdown trigger="click" @command="(command) => changeStatus(row, command)">
          <el-button type="warning" link :loading="actionLoadingId === row.id">
            状态<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="ENABLED" :disabled="row.status === 'ENABLED'">启用</el-dropdown-item>
              <el-dropdown-item command="DISABLED" :disabled="row.status === 'DISABLED'">停用</el-dropdown-item>
              <el-dropdown-item command="LOCKED" :disabled="row.status === 'LOCKED'">锁定</el-dropdown-item>
              <el-dropdown-item command="COUNTING" :disabled="row.status === 'COUNTING'">盘点中</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </CommonDataTable>

    <el-dialog v-model="createDialogVisible" title="新增库位" width="600px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="110px">
        <el-form-item label="仓库" prop="warehouseId">
          <el-select v-model="createForm.warehouseId" filterable placeholder="请选择仓库" @change="handleCreateWarehouseChange">
            <el-option
              v-for="warehouse in warehouseOptions"
              :key="warehouse.value"
              :label="warehouse.label"
              :value="warehouse.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="库区" prop="areaId">
          <el-select v-model="createForm.areaId" filterable placeholder="请先选择仓库" :disabled="!createAreaOptions.length">
            <el-option v-for="area in createAreaOptions" :key="area.id" :label="`${area.areaCode} - ${area.areaName}`" :value="area.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="库位编码" prop="locationCode">
          <el-input v-model.trim="createForm.locationCode" maxlength="64" show-word-limit placeholder="请输入库位编码" />
        </el-form-item>
        <el-form-item label="库位名称" prop="locationName">
          <el-input v-model.trim="createForm.locationName" maxlength="128" show-word-limit placeholder="请输入库位名称" />
        </el-form-item>
        <el-form-item label="库位类型" prop="locationType">
          <el-select v-model="createForm.locationType" placeholder="请选择库位类型">
            <el-option v-for="option in locationTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="容量" prop="capacityQty">
          <el-input-number v-model="createForm.capacityQty" :min="0" :precision="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="允许混放" prop="allowMixedSku">
          <el-switch v-model="createForm.allowMixedSku" />
        </el-form-item>
        <el-form-item label="拣货优先级" prop="pickPriority">
          <el-input-number v-model="createForm.pickPriority" :min="0" :precision="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model.trim="createForm.remark" type="textarea" maxlength="255" show-word-limit placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑库位" width="600px">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="110px">
        <el-form-item label="库位编码">
          <el-input :model-value="editForm.locationCode" disabled />
        </el-form-item>
        <el-form-item label="库位名称" prop="locationName">
          <el-input v-model.trim="editForm.locationName" maxlength="128" show-word-limit placeholder="请输入库位名称" />
        </el-form-item>
        <el-form-item label="库位类型" prop="locationType">
          <el-select v-model="editForm.locationType" placeholder="请选择库位类型">
            <el-option v-for="option in locationTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="容量" prop="capacityQty">
          <el-input-number v-model="editForm.capacityQty" :min="0" :precision="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="允许混放" prop="allowMixedSku">
          <el-switch v-model="editForm.allowMixedSku" />
        </el-form-item>
        <el-form-item label="拣货优先级" prop="pickPriority">
          <el-input-number v-model="editForm.pickPriority" :min="0" :precision="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model.trim="editForm.remark" type="textarea" maxlength="255" show-word-limit placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { ArrowDown } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import CommonQueryForm from '../components/common/CommonQueryForm.vue'
import { formatDateTime, normalizePageResponse } from '../utils/apiResponse'

const axios = inject('$axios')
const loading = ref(false)
const saving = ref(false)
const actionLoadingId = ref(null)
const locations = ref([])
const warehouseOptions = ref([])
const queryAreaOptions = ref([])
const createAreaOptions = ref([])
const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const createFormRef = ref()
const editFormRef = ref()

const locationTypeOptions = [
  { label: '普通库位', value: 'NORMAL' },
  { label: '临时库位', value: 'TEMP' },
  { label: '虚拟库位', value: 'VIRTUAL' }
]

const locationStatusOptions = [
  { label: '启用', value: 'ENABLED' },
  { label: '停用', value: 'DISABLED' },
  { label: '锁定', value: 'LOCKED' },
  { label: '盘点中', value: 'COUNTING' },
  { label: '已满', value: 'FULL' }
]

const queryForm = reactive({
  warehouseId: '',
  areaId: '',
  locationCode: '',
  status: ''
})

const createForm = reactive({
  warehouseId: '',
  areaId: '',
  locationCode: '',
  locationName: '',
  locationType: 'NORMAL',
  capacityQty: 0,
  allowMixedSku: true,
  pickPriority: 0,
  remark: ''
})

const editForm = reactive({
  id: null,
  locationCode: '',
  locationName: '',
  locationType: '',
  capacityQty: 0,
  allowMixedSku: true,
  pickPriority: 0,
  remark: ''
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 20,
  total: 0
})

const queryFields = [
  { prop: 'warehouseId', label: '仓库', type: 'select', placeholder: '请选择仓库', options: [], attrs: { filterable: true } },
  { prop: 'areaId', label: '库区', type: 'select', placeholder: '请先选择仓库', options: [], attrs: { filterable: true } },
  { prop: 'locationCode', label: '库位编码', type: 'input', placeholder: '请输入库位编码', trim: true },
  { prop: 'status', label: '状态', type: 'select', placeholder: '请选择状态', options: locationStatusOptions }
]

const tableColumns = [
  { prop: 'warehouseCode', label: '仓库', minWidth: 140, formatter: (row) => `${row.warehouseCode} - ${row.warehouseName}` },
  { prop: 'areaCode', label: '库区', minWidth: 140, formatter: (row) => `${row.areaCode} - ${row.areaName}` },
  { prop: 'locationCode', label: '库位编码', minWidth: 120 },
  { prop: 'locationName', label: '库位名称', minWidth: 120 },
  { label: '状态', width: 90, slot: 'status', align: 'center' },
  { label: '容量(已用/总量)', width: 130, slot: 'capacity', align: 'center' },
  { label: '允许混放', width: 90, slot: 'allowMixedSku', align: 'center' },
  { prop: 'pickPriority', label: '拣货优先级', width: 100, align: 'center' },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) },
  { label: '操作', width: 160, slot: 'actions', fixed: 'right', align: 'center' }
]

const createRules = {
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  areaId: [{ required: true, message: '请选择库区', trigger: 'change' }],
  locationCode: [{ required: true, message: '请输入库位编码', trigger: 'blur' }],
  locationType: [{ required: true, message: '请选择库位类型', trigger: 'change' }]
}

const editRules = {
  locationType: [{ required: true, message: '请选择库位类型', trigger: 'change' }]
}

const locationStatusLabel = (value) => locationStatusOptions.find((option) => option.value === value)?.label || value || '-'
const statusTagType = (status) => {
  if (status === 'ENABLED') return 'success'
  if (status === 'DISABLED') return 'info'
  if (status === 'FULL') return 'warning'
  return 'danger'
}

const fetchWarehouses = async () => {
  const response = await axios.get('/warehouses', { params: { pageNum: 1, pageSize: 100 } })
  const rows = normalizePageResponse(response).rows
  warehouseOptions.value = rows.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))
  queryFields[0].options = warehouseOptions.value
}

const loadAreasByWarehouse = async (warehouseId) => {
  if (!warehouseId) return []
  const response = await axios.get(`/warehouse-areas/by-warehouse/${warehouseId}`)
  const data = response?.data ?? response
  return Array.isArray(data) ? data : []
}

const handleQueryWarehouseChange = async () => {
  queryForm.areaId = ''
  const areas = await loadAreasByWarehouse(queryForm.warehouseId)
  queryAreaOptions.value = areas
  queryFields[1].options = areas.map((area) => ({ label: `${area.areaCode} - ${area.areaName}`, value: area.id }))
}
queryFields[0].attrs = { ...queryFields[0].attrs, onChange: handleQueryWarehouseChange }

const handleCreateWarehouseChange = async () => {
  createForm.areaId = ''
  createAreaOptions.value = await loadAreasByWarehouse(createForm.warehouseId)
}

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }
  if (queryForm.warehouseId) params.warehouseId = queryForm.warehouseId
  if (queryForm.areaId) params.areaId = queryForm.areaId
  if (queryForm.locationCode) params.locationCode = queryForm.locationCode
  if (queryForm.status) params.status = queryForm.status
  return params
}

const fetchLocations = async () => {
  loading.value = true
  try {
    const response = await axios.get('/warehouse-locations', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    locations.value = rows
    pagination.total = total
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  createForm.warehouseId = ''
  createForm.areaId = ''
  createForm.locationCode = ''
  createForm.locationName = ''
  createForm.locationType = 'NORMAL'
  createForm.capacityQty = 0
  createForm.allowMixedSku = true
  createForm.pickPriority = 0
  createForm.remark = ''
  createAreaOptions.value = []
  createDialogVisible.value = true
}

const submitCreate = async () => {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await axios.post('/warehouse-locations', { ...createForm })
    ElMessage.success('库位创建成功')
    createDialogVisible.value = false
    pagination.pageNum = 1
    await fetchLocations()
  } finally {
    saving.value = false
  }
}

const openEditDialog = (row) => {
  editForm.id = row.id
  editForm.locationCode = row.locationCode
  editForm.locationName = row.locationName
  editForm.locationType = row.locationType
  editForm.capacityQty = row.capacityQty
  editForm.allowMixedSku = row.allowMixedSku
  editForm.pickPriority = row.pickPriority
  editForm.remark = row.remark
  editDialogVisible.value = true
}

const submitEdit = async () => {
  const valid = await editFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await axios.put(`/warehouse-locations/${editForm.id}`, {
      locationName: editForm.locationName,
      locationType: editForm.locationType,
      capacityQty: editForm.capacityQty,
      allowMixedSku: editForm.allowMixedSku,
      pickPriority: editForm.pickPriority,
      remark: editForm.remark
    })
    ElMessage.success('库位更新成功')
    editDialogVisible.value = false
    await fetchLocations()
  } finally {
    saving.value = false
  }
}

const changeStatus = async (row, status) => {
  if (status === row.status) return
  if (status === 'DISABLED' || status === 'LOCKED') {
    const confirmed = await ElMessageBox.confirm(`确认将库位「${row.locationCode}」状态设为「${locationStatusLabel(status)}」吗？`, '提示', { type: 'warning' })
      .then(() => true)
      .catch(() => false)
    if (!confirmed) return
  }

  actionLoadingId.value = row.id
  try {
    await axios.patch(`/warehouse-locations/${row.id}/status`, { status })
    ElMessage.success('库位状态更新成功')
    await fetchLocations()
  } finally {
    actionLoadingId.value = null
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchLocations()
}

const handleReset = () => {
  queryForm.warehouseId = ''
  queryForm.areaId = ''
  queryForm.locationCode = ''
  queryForm.status = ''
  queryAreaOptions.value = []
  queryFields[1].options = []
  pagination.pageNum = 1
  fetchLocations()
}

onMounted(async () => {
  loading.value = true
  try {
    await fetchWarehouses()
    await fetchLocations()
  } finally {
    loading.value = false
  }
})
</script>
