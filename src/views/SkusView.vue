<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>SKU 管理</h2>
        <p>维护商品 SKU 档案，支持按编码、名称和品类查询。</p>
      </div>
      <el-button type="primary" @click="openCreateDialog">新增 SKU</el-button>
    </div>

    <CommonQueryForm
      :model="queryForm"
      :fields="queryFields"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <CommonDataTable
      :data="skus"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无 SKU 数据"
      @pagination-change="fetchSkus"
    >
      <template #enabled="{ row }">
        <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">
          {{ boolLabel(row.enabled) }}
        </el-tag>
      </template>
    </CommonDataTable>

    <el-dialog v-model="createDialogVisible" title="新增 SKU" width="560px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="90px">
        <el-form-item label="SKU 编码" prop="code">
          <el-input v-model.trim="createForm.code" maxlength="64" show-word-limit placeholder="请输入 SKU 编码" />
        </el-form-item>
        <el-form-item label="SKU 名称" prop="name">
          <el-input v-model.trim="createForm.name" maxlength="128" show-word-limit placeholder="请输入 SKU 名称" />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model.trim="createForm.unit" maxlength="32" show-word-limit placeholder="例如 件、箱、个" />
        </el-form-item>
        <el-form-item label="品类" prop="category">
          <el-input v-model.trim="createForm.category" maxlength="64" show-word-limit placeholder="请输入品类" />
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
const skus = ref([])
const createDialogVisible = ref(false)
const createFormRef = ref()

const queryForm = reactive({
  code: '',
  name: '',
  category: ''
})

const createForm = reactive({
  code: '',
  name: '',
  unit: '',
  category: ''
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
})

const queryFields = [
  { prop: 'code', label: 'SKU 编码', type: 'input', placeholder: '请输入 SKU 编码', trim: true },
  { prop: 'name', label: 'SKU 名称', type: 'input', placeholder: '请输入 SKU 名称', trim: true },
  { prop: 'category', label: '品类', type: 'input', placeholder: '请输入品类', trim: true }
]

const tableColumns = [
  { prop: 'code', label: 'SKU 编码', minWidth: 130 },
  { prop: 'name', label: 'SKU 名称', minWidth: 180, showOverflowTooltip: true },
  { prop: 'unit', label: '单位', width: 90, align: 'center' },
  { prop: 'category', label: '品类', minWidth: 120 },
  { label: '状态', width: 100, slot: 'enabled', align: 'center' },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) },
  { label: '更新时间', minWidth: 170, formatter: (row) => formatDateTime(row.updatedAt) }
]

const createRules = {
  code: [{ required: true, message: '请输入 SKU 编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入 SKU 名称', trigger: 'blur' }],
  unit: [{ required: true, message: '请输入单位', trigger: 'blur' }]
}

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }
  if (queryForm.code) params.code = queryForm.code
  if (queryForm.name) params.name = queryForm.name
  if (queryForm.category) params.category = queryForm.category
  return params
}

const fetchSkus = async () => {
  loading.value = true
  try {
    const response = await axios.get('/skus', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    skus.value = rows
    pagination.total = total
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  createForm.code = ''
  createForm.name = ''
  createForm.unit = ''
  createForm.category = ''
  createDialogVisible.value = true
}

const submitCreate = async () => {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await axios.post('/skus', {
      code: createForm.code,
      name: createForm.name,
      unit: createForm.unit,
      category: createForm.category
    })
    ElMessage.success('SKU 创建成功')
    createDialogVisible.value = false
    pagination.pageNum = 1
    await fetchSkus()
  } finally {
    saving.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchSkus()
}

const handleReset = () => {
  queryForm.code = ''
  queryForm.name = ''
  queryForm.category = ''
  pagination.pageNum = 1
  fetchSkus()
}

onMounted(fetchSkus)
</script>
