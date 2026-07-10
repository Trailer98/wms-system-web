<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>仓库管理</h2>
        <p>维护仓库基础资料，支持按仓库编码和名称查询。</p>
      </div>
      <el-button type="primary" @click="openCreateDialog">新增仓库</el-button>
    </div>

    <CommonQueryForm
      :model="queryForm"
      :fields="queryFields"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <CommonDataTable
      :data="warehouses"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无仓库数据"
      @pagination-change="fetchWarehouses"
    >
      <template #enabled="{ row }">
        <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">
          {{ boolLabel(row.enabled) }}
        </el-tag>
      </template>
    </CommonDataTable>

    <el-dialog v-model="createDialogVisible" title="新增仓库" width="520px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="90px">
        <el-form-item label="仓库编码" prop="code">
          <el-input v-model.trim="createForm.code" maxlength="64" show-word-limit placeholder="请输入仓库编码" />
        </el-form-item>
        <el-form-item label="仓库名称" prop="name">
          <el-input v-model.trim="createForm.name" maxlength="128" show-word-limit placeholder="请输入仓库名称" />
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input v-model.trim="createForm.address" maxlength="255" show-word-limit placeholder="请输入仓库地址" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { inject, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import CommonQueryForm from '../components/common/CommonQueryForm.vue'
import { boolLabel, formatDateTime, normalizePageResponse } from '../utils/apiResponse'

const axios = inject('$axios')
const loading = ref(false)
const saving = ref(false)
const warehouses = ref([])
const createDialogVisible = ref(false)
const createFormRef = ref()

const queryForm = reactive({
  code: '',
  name: ''
})

const createForm = reactive({
  code: '',
  name: '',
  address: ''
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 20,
  total: 0
})

const queryFields = [
  { prop: 'code', label: '仓库编码', type: 'input', placeholder: '请输入仓库编码', trim: true },
  { prop: 'name', label: '仓库名称', type: 'input', placeholder: '请输入仓库名称', trim: true }
]

const tableColumns = [
  { prop: 'code', label: '仓库编码', minWidth: 130 },
  { prop: 'name', label: '仓库名称', minWidth: 160 },
  { prop: 'address', label: '地址', minWidth: 220, showOverflowTooltip: true },
  { label: '状态', width: 100, slot: 'enabled', align: 'center' },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) },
  { label: '更新时间', minWidth: 170, formatter: (row) => formatDateTime(row.updatedAt) }
]

const createRules = {
  code: [{ required: true, message: '请输入仓库编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入仓库名称', trigger: 'blur' }]
}

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }
  if (queryForm.code) params.code = queryForm.code
  if (queryForm.name) params.name = queryForm.name
  return params
}

const fetchWarehouses = async () => {
  loading.value = true
  try {
    const response = await axios.get('/warehouses', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    warehouses.value = rows
    pagination.total = total
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  createForm.code = ''
  createForm.name = ''
  createForm.address = ''
  createDialogVisible.value = true
}

const submitCreate = async () => {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await axios.post('/warehouses', {
      code: createForm.code,
      name: createForm.name,
      address: createForm.address
    })
    ElMessage.success('仓库创建成功')
    createDialogVisible.value = false
    pagination.pageNum = 1
    await fetchWarehouses()
  } finally {
    saving.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchWarehouses()
}

const handleReset = () => {
  queryForm.code = ''
  queryForm.name = ''
  pagination.pageNum = 1
  fetchWarehouses()
}

onMounted(fetchWarehouses)
</script>
