<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>角色管理</h2>
        <p>维护系统角色，支持新增、编辑、启停和分配权限。</p>
      </div>
      <el-button v-if="authStore.hasPermission('role:create')" type="primary" @click="openCreateDialog">新增角色</el-button>
    </div>

    <CommonQueryForm
      :model="queryForm"
      :fields="queryFields"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <CommonDataTable
      :data="roles"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无角色数据"
      @pagination-change="fetchRoles"
    >
      <template #status="{ row }">
        <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" effect="plain">
          {{ row.status === 'ENABLED' ? '启用' : '停用' }}
        </el-tag>
      </template>
      <template #actions="{ row }">
        <el-button v-if="authStore.hasPermission('role:update')" type="primary" link @click="openEditDialog(row)">编辑</el-button>
        <el-button v-if="authStore.hasPermission('role:assign')" type="primary" link @click="openPermissionsDialog(row)">分配权限</el-button>
        <el-button
          v-if="authStore.hasPermission('role:update') && row.roleCode !== 'ADMIN'"
          :type="row.status === 'ENABLED' ? 'danger' : 'success'"
          link
          @click="toggleStatus(row)"
        >
          {{ row.status === 'ENABLED' ? '停用' : '启用' }}
        </el-button>
      </template>
    </CommonDataTable>

    <el-dialog v-model="createDialogVisible" title="新增角色" width="480px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="90px">
        <el-form-item label="角色编码" prop="roleCode">
          <el-input v-model.trim="createForm.roleCode" maxlength="64" show-word-limit placeholder="如 WAREHOUSE_MANAGER" />
        </el-form-item>
        <el-form-item label="角色名称" prop="roleName">
          <el-input v-model.trim="createForm.roleName" maxlength="64" show-word-limit placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model.trim="createForm.remark" type="textarea" maxlength="255" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑角色" width="480px">
      <el-form ref="editFormRef" :model="editForm" label-width="90px">
        <el-form-item label="角色编码">
          <el-input :model-value="editForm.roleCode" disabled />
        </el-form-item>
        <el-form-item label="角色名称" prop="roleName">
          <el-input v-model.trim="editForm.roleName" maxlength="64" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model.trim="editForm.remark" type="textarea" maxlength="255" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="permissionsDialogVisible" title="分配权限" width="560px">
      <el-tree
        ref="permissionTreeRef"
        :data="permissionTreeData"
        show-checkbox
        node-key="key"
        :props="{ label: 'label', children: 'children' }"
        default-expand-all
      />
      <template #footer>
        <el-button @click="permissionsDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitPermissions">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { inject, nextTick, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import CommonQueryForm from '../components/common/CommonQueryForm.vue'
import { useAuthStore } from '../stores/auth'
import { formatDateTime, normalizePageResponse, unwrapApiData } from '../utils/apiResponse'

const axios = inject('$axios')
const authStore = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const roles = ref([])
const permissionTreeData = ref([])
const permissionTreeRef = ref()
const activeRoleId = ref(null)

const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const permissionsDialogVisible = ref(false)
const createFormRef = ref()
const editFormRef = ref()

const queryForm = reactive({
  roleCode: '',
  roleName: ''
})

const createForm = reactive({
  roleCode: '',
  roleName: '',
  remark: ''
})

const editForm = reactive({
  roleCode: '',
  roleName: '',
  remark: ''
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 20,
  total: 0
})

const queryFields = [
  { prop: 'roleCode', label: '角色编码', type: 'input', placeholder: '请输入角色编码', trim: true },
  { prop: 'roleName', label: '角色名称', type: 'input', placeholder: '请输入角色名称', trim: true }
]

const tableColumns = [
  { prop: 'roleCode', label: '角色编码', minWidth: 160 },
  { prop: 'roleName', label: '角色名称', minWidth: 140 },
  { prop: 'remark', label: '备注', minWidth: 200, showOverflowTooltip: true },
  { label: '状态', width: 90, slot: 'status', align: 'center' },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createTime) },
  { label: '操作', width: 220, slot: 'actions', fixed: 'right', align: 'center' }
]

const createRules = {
  roleCode: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }]
}

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }
  if (queryForm.roleCode) params.roleCode = queryForm.roleCode
  if (queryForm.roleName) params.roleName = queryForm.roleName
  return params
}

const fetchRoles = async () => {
  loading.value = true
  try {
    const response = await axios.get('/roles/page', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    roles.value = rows
    pagination.total = total
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchRoles()
}

const handleReset = () => {
  queryForm.roleCode = ''
  queryForm.roleName = ''
  pagination.pageNum = 1
  fetchRoles()
}

const openCreateDialog = () => {
  createForm.roleCode = ''
  createForm.roleName = ''
  createForm.remark = ''
  createDialogVisible.value = true
}

const submitCreate = async () => {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await axios.post('/roles', { ...createForm })
    ElMessage.success('角色创建成功')
    createDialogVisible.value = false
    pagination.pageNum = 1
    await fetchRoles()
  } finally {
    saving.value = false
  }
}

const openEditDialog = (row) => {
  activeRoleId.value = row.id
  editForm.roleCode = row.roleCode
  editForm.roleName = row.roleName
  editForm.remark = row.remark
  editDialogVisible.value = true
}

const submitEdit = async () => {
  saving.value = true
  try {
    await axios.put(`/roles/${activeRoleId.value}`, {
      roleName: editForm.roleName,
      remark: editForm.remark
    })
    ElMessage.success('角色信息已更新')
    editDialogVisible.value = false
    await fetchRoles()
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (row) => {
  const nextStatus = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
  const confirmed = await ElMessageBox.confirm(
    `确认${nextStatus === 'ENABLED' ? '启用' : '停用'}角色「${row.roleName}」吗？${nextStatus === 'DISABLED' ? '停用后拥有该角色的用户将失去对应权限。' : ''}`,
    '提示',
    { type: 'warning' }
  ).then(() => true).catch(() => false)
  if (!confirmed) return

  await axios.patch(`/roles/${row.id}/status`, { status: nextStatus })
  ElMessage.success('状态已更新')
  await fetchRoles()
}

const openPermissionsDialog = async (row) => {
  activeRoleId.value = row.id

  const [treeResponse, assignedResponse] = await Promise.all([
    axios.get('/permissions/tree'),
    axios.get(`/roles/${row.id}/permissions`)
  ])
  const modules = unwrapApiData(treeResponse) || []
  permissionTreeData.value = modules.map((module) => ({
    key: `module:${module.module}`,
    label: module.moduleName,
    children: module.permissions.map((permission) => ({
      key: permission.id,
      label: permission.permissionName
    }))
  }))

  permissionsDialogVisible.value = true
  const assigned = (unwrapApiData(assignedResponse) || []).map((permission) => permission.id)
  await nextTick()
  permissionTreeRef.value?.setCheckedKeys(assigned)
}

const submitPermissions = async () => {
  const permissionIds = (permissionTreeRef.value?.getCheckedKeys() || [])
    .filter((key) => typeof key === 'number' || (typeof key === 'string' && !key.startsWith('module:')))

  saving.value = true
  try {
    await axios.post(`/roles/${activeRoleId.value}/permissions`, { permissionIds })
    ElMessage.success('权限分配已保存')
    permissionsDialogVisible.value = false
  } finally {
    saving.value = false
  }
}

onMounted(fetchRoles)
</script>
