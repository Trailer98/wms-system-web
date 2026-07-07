<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>用户管理</h2>
        <p>维护系统登录账号，支持新增、编辑、启停、重置密码和分配角色。</p>
      </div>
      <el-button v-if="authStore.hasPermission('user:create')" type="primary" @click="openCreateDialog">新增用户</el-button>
    </div>

    <CommonQueryForm
      :model="queryForm"
      :fields="queryFields"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <CommonDataTable
      :data="users"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无用户数据"
      @pagination-change="fetchUsers"
    >
      <template #status="{ row }">
        <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" effect="plain">
          {{ row.status === 'ENABLED' ? '启用' : '停用' }}
        </el-tag>
      </template>
      <template #actions="{ row }">
        <el-button v-if="authStore.hasPermission('user:update')" type="primary" link @click="openEditDialog(row)">编辑</el-button>
        <el-button v-if="authStore.hasPermission('user:update')" type="primary" link @click="openRolesDialog(row)">分配角色</el-button>
        <el-button v-if="authStore.hasPermission('user:update')" type="warning" link @click="resetPassword(row)">重置密码</el-button>
        <el-button
          v-if="authStore.hasPermission('user:disable')"
          :type="row.status === 'ENABLED' ? 'danger' : 'success'"
          link
          @click="toggleStatus(row)"
        >
          {{ row.status === 'ENABLED' ? '停用' : '启用' }}
        </el-button>
      </template>
    </CommonDataTable>

    <el-dialog v-model="createDialogVisible" title="新增用户" width="480px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="90px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model.trim="createForm.username" maxlength="64" show-word-limit placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="初始密码" prop="password">
          <el-input v-model="createForm.password" type="password" show-password maxlength="64" placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model.trim="createForm.realName" maxlength="64" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model.trim="createForm.phone" maxlength="32" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model.trim="createForm.email" maxlength="128" placeholder="请输入邮箱" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑用户" width="480px">
      <el-form ref="editFormRef" :model="editForm" label-width="90px">
        <el-form-item label="用户名">
          <el-input :model-value="editForm.username" disabled />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model.trim="editForm.realName" maxlength="64" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model.trim="editForm.phone" maxlength="32" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model.trim="editForm.email" maxlength="128" placeholder="请输入邮箱" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rolesDialogVisible" title="分配角色" width="420px">
      <el-checkbox-group v-model="selectedRoleIds">
        <el-checkbox v-for="role in allRoles" :key="role.id" :value="role.id" class="role-checkbox">
          {{ role.roleName }}（{{ role.roleCode }}）
        </el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="rolesDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitRoles">保存</el-button>
      </template>
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
const users = ref([])
const allRoles = ref([])
const selectedRoleIds = ref([])
const activeUserId = ref(null)

const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const rolesDialogVisible = ref(false)
const createFormRef = ref()
const editFormRef = ref()

const queryForm = reactive({
  username: '',
  status: ''
})

const createForm = reactive({
  username: '',
  password: '',
  realName: '',
  phone: '',
  email: ''
})

const editForm = reactive({
  username: '',
  realName: '',
  phone: '',
  email: ''
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
})

const queryFields = [
  { prop: 'username', label: '用户名', type: 'input', placeholder: '请输入用户名', trim: true },
  {
    prop: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { label: '启用', value: 'ENABLED' },
      { label: '停用', value: 'DISABLED' }
    ]
  }
]

const tableColumns = [
  { prop: 'username', label: '用户名', minWidth: 130 },
  { prop: 'realName', label: '姓名', minWidth: 100 },
  { prop: 'phone', label: '手机号', minWidth: 130 },
  { prop: 'email', label: '邮箱', minWidth: 160, showOverflowTooltip: true },
  { label: '状态', width: 90, slot: 'status', align: 'center' },
  { label: '最近登录', minWidth: 170, formatter: (row) => formatDateTime(row.lastLoginTime) },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createTime) },
  { label: '操作', width: 260, slot: 'actions', fixed: 'right', align: 'center' }
]

const createRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入初始密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ]
}

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }
  if (queryForm.username) params.username = queryForm.username
  if (queryForm.status) params.status = queryForm.status
  return params
}

const fetchUsers = async () => {
  loading.value = true
  try {
    const response = await axios.get('/users/page', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    users.value = rows
    pagination.total = total
  } finally {
    loading.value = false
  }
}

const fetchAllRoles = async () => {
  const response = await axios.get('/roles/page', { params: { pageNum: 1, pageSize: 100 } })
  const { rows } = normalizePageResponse(response)
  allRoles.value = rows
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchUsers()
}

const handleReset = () => {
  queryForm.username = ''
  queryForm.status = ''
  pagination.pageNum = 1
  fetchUsers()
}

const openCreateDialog = () => {
  createForm.username = ''
  createForm.password = ''
  createForm.realName = ''
  createForm.phone = ''
  createForm.email = ''
  createDialogVisible.value = true
}

const submitCreate = async () => {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await axios.post('/users', { ...createForm })
    ElMessage.success('用户创建成功')
    createDialogVisible.value = false
    pagination.pageNum = 1
    await fetchUsers()
  } finally {
    saving.value = false
  }
}

const openEditDialog = (row) => {
  activeUserId.value = row.id
  editForm.username = row.username
  editForm.realName = row.realName
  editForm.phone = row.phone
  editForm.email = row.email
  editDialogVisible.value = true
}

const submitEdit = async () => {
  saving.value = true
  try {
    await axios.put(`/users/${activeUserId.value}`, {
      realName: editForm.realName,
      phone: editForm.phone,
      email: editForm.email
    })
    ElMessage.success('用户信息已更新')
    editDialogVisible.value = false
    await fetchUsers()
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (row) => {
  const nextStatus = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
  const confirmed = await ElMessageBox.confirm(
    `确认${nextStatus === 'ENABLED' ? '启用' : '停用'}用户「${row.username}」吗？`,
    '提示',
    { type: 'warning' }
  ).then(() => true).catch(() => false)
  if (!confirmed) return

  await axios.patch(`/users/${row.id}/status`, { status: nextStatus })
  ElMessage.success('状态已更新')
  await fetchUsers()
}

const resetPassword = async (row) => {
  const confirmed = await ElMessageBox.confirm(
    `确认重置用户「${row.username}」的密码吗？重置后的密码将会展示一次，请妥善转告用户。`,
    '提示',
    { type: 'warning' }
  ).then(() => true).catch(() => false)
  if (!confirmed) return

  const response = await axios.post(`/users/${row.id}/reset-password`, {})
  const data = unwrapApiData(response)
  ElMessageBox.alert(`新密码：${data.newPassword}`, '密码已重置', { confirmButtonText: '知道了' })
}

const openRolesDialog = async (row) => {
  activeUserId.value = row.id
  if (allRoles.value.length === 0) {
    await fetchAllRoles()
  }
  const response = await axios.get(`/users/${row.id}/roles`)
  const currentRoles = unwrapApiData(response) || []
  selectedRoleIds.value = currentRoles.map((role) => role.id)
  rolesDialogVisible.value = true
}

const submitRoles = async () => {
  saving.value = true
  try {
    await axios.post(`/users/${activeUserId.value}/roles`, { roleIds: selectedRoleIds.value })
    ElMessage.success('角色分配已保存')
    rolesDialogVisible.value = false
  } finally {
    saving.value = false
  }
}

onMounted(fetchUsers)
</script>

<style scoped>
.role-checkbox {
  display: block;
  margin: 8px 0;
}
</style>
