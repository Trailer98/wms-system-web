<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>库区管理</h2>
        <p>维护仓库下的库区信息，支持按仓库、库区编码、类型、状态查询。</p>
      </div>
      <el-button type="primary" :disabled="!warehouseOptions.length" @click="openCreateDialog">新增库区</el-button>
    </div>

    <CommonQueryForm
      :model="queryForm"
      :fields="queryFields"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <CommonDataTable
      :data="areas"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无库区数据"
      @pagination-change="fetchAreas"
    >
      <template #areaType="{ row }">{{ areaTypeLabel(row.areaType) }}</template>
      <template #status="{ row }">
        <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" effect="plain">
          {{ areaStatusLabel(row.status) }}
        </el-tag>
      </template>
      <template #actions="{ row }">
        <el-button type="primary" link @click="openEditDialog(row)">编辑</el-button>
        <el-button
          type="warning"
          link
          :loading="actionLoadingId === row.id"
          @click="toggleStatus(row)"
        >
          {{ row.status === 'ENABLED' ? '停用' : '启用' }}
        </el-button>
      </template>
    </CommonDataTable>

    <el-dialog v-model="createDialogVisible" title="新增库区" width="560px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="仓库" prop="warehouseId">
          <el-select v-model="createForm.warehouseId" filterable placeholder="请选择仓库">
            <el-option
              v-for="warehouse in warehouses"
              :key="warehouse.id"
              :label="`${warehouse.code} - ${warehouse.name}`"
              :value="warehouse.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="库区编码" prop="areaCode">
          <el-input v-model.trim="createForm.areaCode" maxlength="64" show-word-limit placeholder="请输入库区编码" />
        </el-form-item>
        <el-form-item label="库区名称" prop="areaName">
          <el-input v-model.trim="createForm.areaName" maxlength="128" show-word-limit placeholder="请输入库区名称" />
        </el-form-item>
        <el-form-item label="库区类型" prop="areaType">
          <el-select v-model="createForm.areaType" placeholder="请选择库区类型">
            <el-option v-for="option in areaTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
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

    <el-dialog v-model="editDialogVisible" title="编辑库区" width="560px">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="100px">
        <el-form-item label="库区编码">
          <el-input :model-value="editForm.areaCode" disabled />
        </el-form-item>
        <el-form-item label="库区名称" prop="areaName">
          <el-input v-model.trim="editForm.areaName" maxlength="128" show-word-limit placeholder="请输入库区名称" />
        </el-form-item>
        <el-form-item label="库区类型" prop="areaType">
          <el-select v-model="editForm.areaType" placeholder="请选择库区类型">
            <el-option v-for="option in areaTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import CommonQueryForm from '../components/common/CommonQueryForm.vue'
import { formatDateTime, normalizePageResponse } from '../utils/apiResponse'

const axios = inject('$axios')
const loading = ref(false)
const saving = ref(false)
const actionLoadingId = ref(null)
const areas = ref([])
const warehouses = ref([])
const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const createFormRef = ref()
const editFormRef = ref()

const areaTypeOptions = [
  { label: '收货区', value: 'RECEIVING' },
  { label: '存储区', value: 'STORAGE' },
  { label: '拣货区', value: 'PICKING' },
  { label: '质检区', value: 'QC' },
  { label: '复核区', value: 'REVIEW' },
  { label: '发货区', value: 'SHIPPING' },
  { label: '异常区', value: 'EXCEPTION' },
  { label: '冻结区', value: 'FROZEN' }
]

const areaStatusOptions = [
  { label: '启用', value: 'ENABLED' },
  { label: '停用', value: 'DISABLED' }
]

const queryForm = reactive({
  warehouseId: '',
  areaCode: '',
  areaName: '',
  areaType: '',
  status: ''
})

const createForm = reactive({
  warehouseId: '',
  areaCode: '',
  areaName: '',
  areaType: '',
  pickPriority: 0,
  remark: ''
})

const editForm = reactive({
  id: null,
  areaCode: '',
  areaName: '',
  areaType: '',
  pickPriority: 0,
  remark: ''
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 20,
  total: 0
})

const warehouseOptions = ref([])

const queryFields = [
  { prop: 'warehouseId', label: '仓库', type: 'select', placeholder: '请选择仓库', options: [], attrs: { filterable: true } },
  { prop: 'areaCode', label: '库区编码', type: 'input', placeholder: '请输入库区编码', trim: true },
  { prop: 'areaName', label: '库区名称', type: 'input', placeholder: '请输入库区名称', trim: true },
  { prop: 'areaType', label: '库区类型', type: 'select', placeholder: '请选择库区类型', options: areaTypeOptions },
  { prop: 'status', label: '状态', type: 'select', placeholder: '请选择状态', options: areaStatusOptions }
]

const tableColumns = [
  { prop: 'warehouseCode', label: '仓库', minWidth: 140, formatter: (row) => `${row.warehouseCode} - ${row.warehouseName}` },
  { prop: 'areaCode', label: '库区编码', minWidth: 120 },
  { prop: 'areaName', label: '库区名称', minWidth: 140 },
  { label: '库区类型', width: 100, slot: 'areaType', align: 'center' },
  { label: '状态', width: 90, slot: 'status', align: 'center' },
  { prop: 'pickPriority', label: '拣货优先级', width: 100, align: 'center' },
  { prop: 'remark', label: '备注', minWidth: 160, showOverflowTooltip: true },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) },
  { label: '操作', width: 130, slot: 'actions', fixed: 'right', align: 'center' }
]

const createRules = {
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  areaCode: [{ required: true, message: '请输入库区编码', trigger: 'blur' }],
  areaName: [{ required: true, message: '请输入库区名称', trigger: 'blur' }],
  areaType: [{ required: true, message: '请选择库区类型', trigger: 'change' }]
}

const editRules = {
  areaName: [{ required: true, message: '请输入库区名称', trigger: 'blur' }],
  areaType: [{ required: true, message: '请选择库区类型', trigger: 'change' }]
}

const areaTypeLabel = (value) => areaTypeOptions.find((option) => option.value === value)?.label || value || '-'
const areaStatusLabel = (value) => areaStatusOptions.find((option) => option.value === value)?.label || value || '-'

const fetchWarehouses = async () => {
  const response = await axios.get('/warehouses', { params: { pageNum: 1, pageSize: 100 } })
  warehouses.value = normalizePageResponse(response).rows
  warehouseOptions.value = warehouses.value.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))
  queryFields[0].options = warehouseOptions.value
}

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }
  if (queryForm.warehouseId) params.warehouseId = queryForm.warehouseId
  if (queryForm.areaCode) params.areaCode = queryForm.areaCode
  if (queryForm.areaName) params.areaName = queryForm.areaName
  if (queryForm.areaType) params.areaType = queryForm.areaType
  if (queryForm.status) params.status = queryForm.status
  return params
}

const fetchAreas = async () => {
  loading.value = true
  try {
    const response = await axios.get('/warehouse-areas', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    areas.value = rows
    pagination.total = total
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  createForm.warehouseId = ''
  createForm.areaCode = ''
  createForm.areaName = ''
  createForm.areaType = ''
  createForm.pickPriority = 0
  createForm.remark = ''
  createDialogVisible.value = true
}

const submitCreate = async () => {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await axios.post('/warehouse-areas', { ...createForm })
    ElMessage.success('库区创建成功')
    createDialogVisible.value = false
    pagination.pageNum = 1
    await fetchAreas()
  } finally {
    saving.value = false
  }
}

const openEditDialog = (row) => {
  editForm.id = row.id
  editForm.areaCode = row.areaCode
  editForm.areaName = row.areaName
  editForm.areaType = row.areaType
  editForm.pickPriority = row.pickPriority
  editForm.remark = row.remark
  editDialogVisible.value = true
}

const submitEdit = async () => {
  const valid = await editFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await axios.put(`/warehouse-areas/${editForm.id}`, {
      areaName: editForm.areaName,
      areaType: editForm.areaType,
      pickPriority: editForm.pickPriority,
      remark: editForm.remark
    })
    ElMessage.success('库区更新成功')
    editDialogVisible.value = false
    await fetchAreas()
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (row) => {
  const nextStatus = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
  if (nextStatus === 'DISABLED') {
    const confirmed = await ElMessageBox.confirm(`确认停用库区「${row.areaName}」吗？`, '提示', { type: 'warning' })
      .then(() => true)
      .catch(() => false)
    if (!confirmed) return
  }

  actionLoadingId.value = row.id
  try {
    await axios.patch(`/warehouse-areas/${row.id}/status`, { status: nextStatus })
    ElMessage.success(nextStatus === 'ENABLED' ? '库区已启用' : '库区已停用')
    await fetchAreas()
  } finally {
    actionLoadingId.value = null
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchAreas()
}

const handleReset = () => {
  queryForm.warehouseId = ''
  queryForm.areaCode = ''
  queryForm.areaName = ''
  queryForm.areaType = ''
  queryForm.status = ''
  pagination.pageNum = 1
  fetchAreas()
}

onMounted(async () => {
  loading.value = true
  try {
    await fetchWarehouses()
    await fetchAreas()
  } finally {
    loading.value = false
  }
})
</script>
