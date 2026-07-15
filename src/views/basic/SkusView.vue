<!-- =============================================
  SkusView.vue — SKU 管理页面

  这是典型的 WMS CRUD（增删改查）页面模板。
  学会这个页面，其他类似页面（Warehouses、Customers 等）
  只需要看字段定义和 API 路径差异即可理解。

  Vue 单文件组件结构：
    <template>  — HTML 模板（页面长什么样）
    <script>    — JS 逻辑（数据、函数、生命周期）
    <style>     — CSS 样式（只作用于本组件）
============================================= -->

<template>
  <!-- page-shell 是一个通用容器样式，每个页面都套用它 -->
  <section class="page-shell">
    <!-- 页面头部：标题 + 描述 + 操作按钮 -->
    <div class="page-header">
      <div>
        <h2>SKU 管理</h2>
        <p>维护商品 SKU 档案，支持按编码、名称和品类查询。</p>
      </div>
      <!-- type="primary" 是 Element Plus 的蓝色主按钮 -->
      <!-- @click="openCreateDialog" 点击时调用 JS 里的 openCreateDialog() 函数 -->
      <el-button type="primary" @click="openCreateDialog">新增 SKU</el-button>
    </div>

    <!--
      CommonQueryForm — 通用查询条件组件
      :model="queryForm"       → 双向绑定查询表单的数据对象
      :fields="queryFields"    → 查询字段的配置（有哪些输入框）
      :loading="loading"       → 是否显示加载中状态
      @search="handleSearch"   → 点击"查询"按钮时触发
      @reset="handleReset"     → 点击"重置"按钮时触发
    -->
    <CommonQueryForm
      :model="queryForm"
      :fields="queryFields"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!--
      CommonDataTable — 通用数据表格组件
      :data="skus"              → 表格要显示的数据列表
      :columns="tableColumns"   → 表格列的配置（列名、宽度、格式化等）
      :loading="loading"        → 加载中动画
      :pagination="pagination"  → 分页信息（当前页、每页条数、总数）
      empty-text="..."          → 数据为空时显示的提示文字
      @pagination-change="fetchSkus"  → 切换页码时重新请求数据
    -->
    <CommonDataTable
      :data="skus"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无 SKU 数据"
      @pagination-change="fetchSkus"
    >
      <!--
        #enabled="{ row }" — 自定义列插槽
        对于列定义中 slot: 'enabled' 的列，用这里的内容代替默认显示
        row 是当前行的数据对象，row.enabled 就是这个 SKU 是否启用
      -->
      <template #enabled="{ row }">
        <!-- el-tag 是 Element Plus 的标签组件，type 控制颜色 -->
        <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">
          {{ boolLabel(row.enabled) }}
        </el-tag>
      </template>
    </CommonDataTable>

    <!--
      el-dialog — Element Plus 弹窗组件
      v-model="createDialogVisible" → true 时显示弹窗，false 时隐藏
      title="新增 SKU"              → 弹窗标题
      width="560px"                → 弹窗宽度
    -->
    <el-dialog v-model="createDialogVisible" title="新增 SKU" width="560px">
      <!--
        el-form — Element Plus 表单组件
        ref="createFormRef"   → 给表单一个引用，JS 里可以调用它的验证方法
        :model="createForm"   → 表单数据对象
        :rules="createRules"  → 校验规则（哪些字段必填等）
        label-width="90px"    → 标签宽度
      -->
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="90px">
        <!--
          el-form-item — 表单项，对应一个字段
          label="SKU 编码"  → 显示在输入框左边的标签
          prop="code"      → 对应 createForm.code 这个字段
        -->
        <el-form-item label="SKU 编码" prop="code">
          <!--
            el-input — 输入框
            v-model.trim="createForm.code" → 双向绑定，trim 表示自动去掉首尾空格
            maxlength="64"                 → 最大输入 64 个字符
            show-word-limit                → 显示已输入/最大字符数
          -->
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
      <!-- #footer — 弹窗底部按钮区域（Element Plus 内置 slot） -->
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <!-- :loading="saving" 保存中显示加载动画，防止重复点击 -->
        <el-button type="primary" :loading="saving" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<!--
  <script setup> — Vue 3 组合式 API 写法
  "setup" 表示这个 script 里的变量和函数可以直接在 template 中使用
  不需要再写 export default {} 来注册了
-->
<script setup>
// ── 导入工具 ──
import { ElMessage } from 'element-plus'               // Element Plus 的消息提示组件
import { inject, onMounted, reactive, ref } from 'vue'  // Vue 核心 API
import CommonDataTable from '../../components/common/CommonDataTable.vue'
import CommonQueryForm from '../../components/common/CommonQueryForm.vue'
import { boolLabel, formatDateTime, normalizePageResponse } from '../../utils/apiResponse.js'

// ── 依赖注入 ──
// inject('$axios') 获取 plugins/axios.js 中注入的 Axios 实例
// 等同于使用全局的 axios，用于发起 HTTP 请求
const axios = inject('$axios')

// ── 响应式变量 ──
// ref() 创建响应式数据：值改变时，Vue 自动更新页面
const loading = ref(false)   // 表格是否在加载中（true 时显示加载动画）
const saving = ref(false)    // 保存按钮是否在保存中
const skus = ref([])         // SKU 列表数据（从后端 API 获取）
const createDialogVisible = ref(false)  // 控制新增弹窗的显示/隐藏
const createFormRef = ref()             // 引用新增表单，用于调用表单验证

// ── 响应式对象 ──
// reactive() 创建响应式对象，适合多个关联字段
// 查询表单的数据模型
const queryForm = reactive({
  code: '',      // SKU 编码查询条件
  name: '',      // SKU 名称查询条件
  category: ''   // 品类查询条件
})

// 新增 SKU 表单的数据模型
const createForm = reactive({
  code: '',
  name: '',
  unit: '',
  category: ''
})

// 分页信息
const pagination = reactive({
  pageNum: 1,   // 当前页码（从 1 开始）
  pageSize: 20, // 每页显示条数
  total: 0       // 总记录数（由后端返回）
})

// ── 查询字段配置 ──
// 告诉 CommonQueryForm 组件：查询区要显示哪些输入框
// 每个对象 = 一个输入框
const queryFields = [
  { prop: 'code', label: 'SKU 编码', type: 'input', placeholder: '请输入 SKU 编码', trim: true },
  { prop: 'name', label: 'SKU 名称', type: 'input', placeholder: '请输入 SKU 名称', trim: true },
  { prop: 'category', label: '品类', type: 'input', placeholder: '请输入品类', trim: true }
]

// ── 表格列配置 ──
// 告诉 CommonDataTable 组件：表格要显示哪些列
// prop: 对应后端返回数据的字段名
// label: 表头显示的列名
// width/minWidth: 列宽
// slot: 'enabled' → 表示这一列使用上面的 #enabled 插槽自定义渲染
// formatter: 自定义格式化函数
// showOverflowTooltip: 内容超出时显示 tooltip
const tableColumns = [
  { prop: 'code', label: 'SKU 编码', minWidth: 130 },
  { prop: 'name', label: 'SKU 名称', minWidth: 180, showOverflowTooltip: true },
  { prop: 'unit', label: '单位', width: 90, align: 'center' },
  { prop: 'category', label: '品类', minWidth: 120 },
  { label: '状态', width: 100, slot: 'enabled', align: 'center' },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) },
  { label: '更新时间', minWidth: 170, formatter: (row) => formatDateTime(row.updatedAt) }
]

// ── 表单校验规则 ──
// required: true  → 必填
// message: '...'  → 校验失败时的提示文字
// trigger: 'blur' → 在输入框失去焦点时触发校验
const createRules = {
  code: [{ required: true, message: '请输入 SKU 编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入 SKU 名称', trigger: 'blur' }],
  unit: [{ required: true, message: '请输入单位', trigger: 'blur' }]
}

// ── 辅助函数 ──

/**
 * 构建请求参数
 * 把查询表单 + 分页信息合并成一个对象，作为 API 请求的参数
 */
const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize
  }
  // 只有用户输入了查询条件，才加到参数里
  if (queryForm.code) params.code = queryForm.code
  if (queryForm.name) params.name = queryForm.name
  if (queryForm.category) params.category = queryForm.category
  return params
}

// ── 数据请求 ──

/**
 * 向后端请求 SKU 列表数据
 * 这是最核心的函数，理解它就读懂了数据流：
 *   1. 设置 loading=true → 页面显示加载动画
 *   2. 调用 axios.get('/skus', { params }) → 发 GET 请求给后端
 *   3. 后端返回数据 → 存到 skus 和 pagination.total
 *   4. 设置 loading=false → 加载动画消失，表格显示数据
 */
const fetchSkus = async () => {
  loading.value = true
  try {
    // 向后端发 GET 请求：/api/skus?pageNum=1&pageSize=20&code=xxx&name=xxx
    // vite.config.js 中配置了代理，/api 开头的请求会转发到 http://localhost:8081
    const response = await axios.get('/skus', { params: buildParams() })
    // normalizePageResponse 解析后端返回的分页数据结构（统一格式）
    const { rows, total } = normalizePageResponse(response)
    skus.value = rows          // 把数据赋值给 skus, 表格会自动更新
    pagination.total = total   // 更新总条数, 分页器自动计算总页数
  } finally {
    loading.value = false
  }
}

// ── 新增操作 ──

/**
 * 打开新增弹窗
 * 清除表单数据 → 显示弹窗
 */
const openCreateDialog = () => {
  createForm.code = ''
  createForm.name = ''
  createForm.unit = ''
  createForm.category = ''
  createDialogVisible.value = true
}

/**
 * 提交新增 SKU
 * 流程：
 *   1. 表单校验 → 不通过则返回
 *   2. 调用 axios.post('/skus', {...}) → 发 POST 请求给后端
 *   3. 成功后弹出提示 → 关闭弹窗 → 回到第一页 → 刷新列表
 */
const submitCreate = async () => {
  // validate() 是 el-form 的校验方法，不通过会抛异常
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    // 向后端发 POST 请求：/api/skus，请求体是 JSON 格式的 SKU 数据
    await axios.post('/skus', {
      code: createForm.code,
      name: createForm.name,
      unit: createForm.unit,
      category: createForm.category
    })
    ElMessage.success('SKU 创建成功')    // 顶部弹出绿色成功提示
    createDialogVisible.value = false     // 关闭弹窗
    pagination.pageNum = 1                // 跳回第一页（新数据在第一页）
    await fetchSkus()                     // 重新加载列表
  } finally {
    saving.value = false
  }
}

// ── 查询/重置操作 ──

/** 点击"查询"按钮：回到第一页，重新请求 */
const handleSearch = () => {
  pagination.pageNum = 1
  fetchSkus()
}

/** 点击"重置"按钮：清空查询条件，回到第一页，重新请求 */
const handleReset = () => {
  queryForm.code = ''
  queryForm.name = ''
  queryForm.category = ''
  pagination.pageNum = 1
  fetchSkus()
}

// ── 生命周期 ──
// onMounted() → 当组件被挂载到页面上时自动执行
// 即：页面加载完成后自动请求数据，显示在表格中
onMounted(fetchSkus)
</script>

<!--
  <style scoped> — 组件私有样式
  scoped 关键字表示这里的 CSS 只影响本组件的元素，不影响全局
-->
<style scoped>
/* page-shell 是每个页面最外层的容器类 */
.page-shell {
    max-width: 1200px; /* 最大宽度，避免在大屏上无限拉伸 */
}
</style>
