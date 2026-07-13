<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>AI 知识管理</h2>
        <p>维护 WMS 业务规则 / SOP / 字段字典等知识文档，自动分片并写入向量索引，供智能助手检索。</p>
      </div>
      <el-button v-if="authStore.hasPermission('ai-knowledge:create')" type="primary" @click="openCreate">
        新增知识
      </el-button>
    </div>

    <CommonQueryForm
      :model="queryForm"
      :fields="queryFields"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <CommonDataTable
      :data="documents"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无知识文档"
      @pagination-change="fetchDocuments"
    >
      <template #module="{ row }">{{ row.moduleLabel || row.module }}</template>
      <template #sourceType="{ row }">{{ row.sourceTypeLabel || row.sourceType }}</template>
      <template #status="{ row }">
        <el-tag :type="statusTagType(row.status)" effect="plain">{{ statusLabel(row.status) }}</el-tag>
      </template>
      <template #chunks="{ row }">
        <span>{{ row.chunkCount }}</span>
        <el-tag v-if="row.indexedChunkCount" size="small" type="success" effect="plain" class="chunk-tag">
          已索引 {{ row.indexedChunkCount }}
        </el-tag>
        <el-tag v-if="row.failedChunkCount" size="small" type="danger" effect="plain" class="chunk-tag">
          失败 {{ row.failedChunkCount }}
        </el-tag>
      </template>
      <template #actions="{ row }">
        <el-button type="primary" link @click="openDetail(row)">详情</el-button>
        <el-button type="primary" link @click="openChunks(row)">分片</el-button>
        <el-button v-if="authStore.hasPermission('ai-knowledge:update')" type="primary" link @click="openEdit(row)">编辑</el-button>
        <el-button
          v-if="authStore.hasPermission('ai-knowledge:disable') && row.status !== 'ENABLED'"
          type="success"
          link
          @click="changeStatus(row, 'ENABLED')"
        >启用</el-button>
        <el-button
          v-if="authStore.hasPermission('ai-knowledge:disable') && row.status === 'ENABLED'"
          type="warning"
          link
          @click="changeStatus(row, 'DISABLED')"
        >停用</el-button>
        <el-button
          v-if="authStore.hasPermission('ai-knowledge:vectorize')"
          type="primary"
          link
          :loading="actionLoadingId === row.id"
          @click="vectorize(row)"
        >重新向量化</el-button>
      </template>
    </CommonDataTable>

    <!-- Create / Edit dialog -->
    <el-dialog
      v-model="formVisible"
      :title="editingId ? '编辑知识' : '新增知识'"
      width="720px"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="标题" prop="title">
              <el-input v-model="form.title" maxlength="255" placeholder="如：出库锁库库存校验规则" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="知识编码" prop="docCode">
              <el-input v-model="form.docCode" placeholder="留空后端自动生成" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="业务模块" prop="module">
              <el-select v-model="form.module" placeholder="请选择模块" filterable>
                <el-option v-for="o in moduleOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="来源类型" prop="sourceType">
              <el-select v-model="form.sourceType" placeholder="请选择来源类型" filterable>
                <el-option v-for="o in sourceTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="业务类型"><el-input v-model="form.bizType" placeholder="如 OUTBOUND_ORDER" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="操作类型"><el-input v-model="form.operationType" placeholder="如 OUTBOUND_LOCK" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="实体名"><el-input v-model="form.entityName" placeholder="如 outbound_order" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="版本"><el-input v-model="form.version" placeholder="如 v1.0" /></el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="业务场景"><el-input v-model="form.scenario" placeholder="一句话描述适用场景" /></el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="关键词">
              <el-input v-model="form.keywords" placeholder="逗号分隔，如：出库,锁库,可用库存" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="内容格式">
              <el-select v-model="form.contentFormat">
                <el-option v-for="o in contentFormatOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="分片策略">
              <el-select v-model="form.chunkStrategy">
                <el-option v-for="o in chunkStrategyOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态">
              <el-select v-model="form.status">
                <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="自动向量化">
              <el-switch v-model="form.autoVectorize" />
              <span class="hint">保存后立即分片并写入向量索引（向量库不可用时分片会标记为失败，不影响知识保存）。</span>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="正文" prop="content">
              <el-input v-model="form.content" type="textarea" :rows="14" placeholder="支持 Markdown，使用 ## / ### 标题便于语义分片" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- Detail dialog -->
    <el-dialog v-model="detailVisible" title="知识详情" width="720px">
      <el-descriptions v-if="activeDetail" :column="2" border>
        <el-descriptions-item label="知识编码">{{ activeDetail.docCode }}</el-descriptions-item>
        <el-descriptions-item label="标题">{{ activeDetail.title }}</el-descriptions-item>
        <el-descriptions-item label="模块">{{ activeDetail.moduleLabel || activeDetail.module }}</el-descriptions-item>
        <el-descriptions-item label="来源类型">{{ activeDetail.sourceTypeLabel || activeDetail.sourceType }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ activeDetail.bizType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="操作类型">{{ activeDetail.operationType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="实体名">{{ activeDetail.entityName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ activeDetail.version || '-' }}</el-descriptions-item>
        <el-descriptions-item label="分片策略">{{ activeDetail.chunkStrategy }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusLabel(activeDetail.status) }}</el-descriptions-item>
        <el-descriptions-item label="场景" :span="2">{{ activeDetail.scenario || '-' }}</el-descriptions-item>
        <el-descriptions-item label="关键词" :span="2">
          <el-tag v-for="kw in activeDetail.keywords" :key="kw" size="small" class="chunk-tag">{{ kw }}</el-tag>
          <span v-if="!activeDetail.keywords || !activeDetail.keywords.length">-</span>
        </el-descriptions-item>
        <el-descriptions-item label="正文" :span="2">
          <pre class="content-pre">{{ activeDetail.content }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- Chunks dialog -->
    <el-dialog v-model="chunksVisible" title="知识分片" width="820px">
      <div class="chunks-doc">{{ chunksDocTitle }}</div>
      <CommonDataTable
        :data="chunks"
        :columns="chunkColumns"
        :loading="chunksLoading"
        :pagination="chunkPagination"
        empty-text="暂无分片"
        @pagination-change="fetchChunks"
      >
        <template #vectorStatus="{ row }">
          <el-tag :type="vectorTagType(row.vectorStatus)" effect="plain">{{ vectorLabel(row.vectorStatus) }}</el-tag>
        </template>
        <template #content="{ row }">
          <span class="chunk-content" :title="row.content">{{ row.content }}</span>
        </template>
      </CommonDataTable>
    </el-dialog>
  </section>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import CommonDataTable from '../../components/common/CommonDataTable.vue'
import CommonQueryForm from '../../components/common/CommonQueryForm.vue'
import { useAuthStore } from '../../stores/auth'
import { useDict } from '../../composables/useDict'
import { formatDateTime, normalizePageResponse, unwrapApiData } from '../../utils/apiResponse'
import {
  changeKnowledgeDocumentStatus,
  createKnowledgeDocument,
  getKnowledgeDocumentChunks,
  getKnowledgeDocumentDetail,
  getKnowledgeDocumentsPage,
  updateKnowledgeDocument,
  vectorizeKnowledgeDocument
} from '../../api/aiKnowledge'

const authStore = useAuthStore()

const DICT_MODULE = 'ai_knowledge_module'
const DICT_SOURCE_TYPE = 'ai_knowledge_source_type'
const DICT_STATUS = 'ai_knowledge_status'
const DICT_CONTENT_FORMAT = 'ai_knowledge_content_format'
const DICT_CHUNK_STRATEGY = 'ai_knowledge_chunk_strategy'
const DICT_VECTOR_STATUS = 'ai_knowledge_vector_status'

const { preload, getDictLabel, getDictTagType, getDictOptions } = useDict([
  DICT_MODULE, DICT_SOURCE_TYPE, DICT_STATUS, DICT_CONTENT_FORMAT, DICT_CHUNK_STRATEGY, DICT_VECTOR_STATUS
])

const loading = ref(false)
const submitting = ref(false)
const actionLoadingId = ref(null)
const documents = ref([])

const pagination = reactive({ pageNum: 1, pageSize: 20, total: 0 })

const queryForm = reactive({
  keyword: '',
  module: '',
  sourceType: '',
  status: '',
  vectorStatus: ''
})

const moduleOptions = computed(() => getDictOptions(DICT_MODULE))
const sourceTypeOptions = computed(() => getDictOptions(DICT_SOURCE_TYPE))
const statusOptions = computed(() => getDictOptions(DICT_STATUS))
const contentFormatOptions = computed(() => getDictOptions(DICT_CONTENT_FORMAT))
const chunkStrategyOptions = computed(() => getDictOptions(DICT_CHUNK_STRATEGY))
const vectorStatusOptions = computed(() => getDictOptions(DICT_VECTOR_STATUS))

const statusLabel = (value) => getDictLabel(DICT_STATUS, value)
const statusTagType = (value) => getDictTagType(DICT_STATUS, value) || 'info'
const vectorLabel = (value) => getDictLabel(DICT_VECTOR_STATUS, value)
const vectorTagType = (value) => getDictTagType(DICT_VECTOR_STATUS, value) || 'info'

const queryFields = computed(() => [
  { prop: 'keyword', label: '关键词', type: 'input', placeholder: '标题 / 编码 / 关键词', trim: true },
  { prop: 'module', label: '模块', type: 'select', placeholder: '全部模块', options: moduleOptions.value },
  { prop: 'sourceType', label: '来源类型', type: 'select', placeholder: '全部类型', options: sourceTypeOptions.value },
  { prop: 'status', label: '状态', type: 'select', placeholder: '全部状态', options: statusOptions.value },
  { prop: 'vectorStatus', label: '向量状态', type: 'select', placeholder: '全部', options: vectorStatusOptions.value }
])

const tableColumns = [
  { prop: 'docCode', label: '知识编码', minWidth: 170, showOverflowTooltip: true },
  { prop: 'title', label: '标题', minWidth: 180, showOverflowTooltip: true },
  { label: '模块', width: 110, slot: 'module' },
  { label: '来源类型', width: 110, slot: 'sourceType' },
  { prop: 'version', label: '版本', width: 80 },
  { label: '状态', width: 90, slot: 'status', align: 'center' },
  { label: '分片', minWidth: 150, slot: 'chunks' },
  { label: '更新时间', minWidth: 170, formatter: (row) => formatDateTime(row.updatedAt) },
  { label: '操作', width: 320, slot: 'actions', fixed: 'right', align: 'center' }
]

const buildParams = () => {
  const params = { pageNum: pagination.pageNum, pageSize: pagination.pageSize }
  if (queryForm.keyword) params.keyword = queryForm.keyword
  if (queryForm.module) params.module = queryForm.module
  if (queryForm.sourceType) params.sourceType = queryForm.sourceType
  if (queryForm.status) params.status = queryForm.status
  if (queryForm.vectorStatus) params.vectorStatus = queryForm.vectorStatus
  return params
}

const fetchDocuments = async () => {
  loading.value = true
  try {
    const response = await getKnowledgeDocumentsPage(buildParams())
    const { rows, total } = normalizePageResponse(response)
    documents.value = rows
    pagination.total = total
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchDocuments()
}

const handleReset = () => {
  queryForm.keyword = ''
  queryForm.module = ''
  queryForm.sourceType = ''
  queryForm.status = ''
  queryForm.vectorStatus = ''
  pagination.pageNum = 1
  fetchDocuments()
}

// ---- create / edit ----
const formVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)
const form = reactive(defaultForm())

function defaultForm() {
  return {
    title: '', docCode: '', module: '', sourceType: '', bizType: '', operationType: '',
    entityName: '', scenario: '', keywords: '', version: 'v1.0', contentFormat: 'MARKDOWN',
    chunkStrategy: 'SEMANTIC_MARKDOWN', status: 'ENABLED', autoVectorize: true, content: ''
  }
}

const formRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  module: [{ required: true, message: '请选择模块', trigger: 'change' }],
  sourceType: [{ required: true, message: '请选择来源类型', trigger: 'change' }],
  content: [{ required: true, message: '请输入正文', trigger: 'blur' }]
}

const resetForm = () => {
  editingId.value = null
  Object.assign(form, defaultForm())
  formRef.value?.clearValidate()
}

const openCreate = () => {
  resetForm()
  formVisible.value = true
}

const openEdit = async (row) => {
  const detail = unwrapApiData(await getKnowledgeDocumentDetail(row.id))
  editingId.value = row.id
  Object.assign(form, {
    title: detail.title,
    docCode: detail.docCode,
    module: detail.module,
    sourceType: detail.sourceType,
    bizType: detail.bizType || '',
    operationType: detail.operationType || '',
    entityName: detail.entityName || '',
    scenario: detail.scenario || '',
    keywords: (detail.keywords || []).join(','),
    version: detail.version || 'v1.0',
    contentFormat: detail.contentFormat || 'MARKDOWN',
    chunkStrategy: detail.chunkStrategy || 'SEMANTIC_MARKDOWN',
    status: detail.status || 'ENABLED',
    autoVectorize: true,
    content: detail.content || ''
  })
  formVisible.value = true
}

const parseKeywords = (value) =>
  (value || '')
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)

const submitForm = async () => {
  await formRef.value.validate()
  submitting.value = true
  try {
    const payload = { ...form, keywords: parseKeywords(form.keywords) }
    const response = editingId.value
      ? await updateKnowledgeDocument(editingId.value, payload)
      : await createKnowledgeDocument(payload)
    const data = unwrapApiData(response)
    ElMessage.success(
      `${editingId.value ? '已更新' : '已创建'}：生成 ${data.chunkCount} 个分片` +
      (data.vectorized ? '，向量化成功' : '（未向量化）')
    )
    formVisible.value = false
    fetchDocuments()
  } finally {
    submitting.value = false
  }
}

// ---- status / vectorize ----
const changeStatus = async (row, status) => {
  await changeKnowledgeDocumentStatus(row.id, status)
  ElMessage.success(status === 'ENABLED' ? '已启用' : '已停用')
  fetchDocuments()
}

const vectorize = async (row) => {
  actionLoadingId.value = row.id
  try {
    const result = unwrapApiData(await vectorizeKnowledgeDocument(row.id, true))
    ElMessage.success(result.message || '向量化完成')
    fetchDocuments()
  } finally {
    actionLoadingId.value = null
  }
}

// ---- detail ----
const detailVisible = ref(false)
const activeDetail = ref(null)
const openDetail = async (row) => {
  activeDetail.value = unwrapApiData(await getKnowledgeDocumentDetail(row.id))
  detailVisible.value = true
}

// ---- chunks ----
const chunksVisible = ref(false)
const chunksLoading = ref(false)
const chunks = ref([])
const chunksDocId = ref(null)
const chunksDocTitle = ref('')
const chunkPagination = reactive({ pageNum: 1, pageSize: 20, total: 0 })

const chunkColumns = [
  { prop: 'chunkCode', label: '分片编码', width: 190, showOverflowTooltip: true },
  { prop: 'sortOrder', label: '序号', width: 70, align: 'center' },
  { label: '内容', minWidth: 260, slot: 'content' },
  { label: '向量状态', width: 110, slot: 'vectorStatus', align: 'center' },
  { prop: 'vectorErrorMessage', label: '错误信息', minWidth: 160, showOverflowTooltip: true, formatter: (row) => row.vectorErrorMessage || '-' }
]

const openChunks = (row) => {
  chunksDocId.value = row.id
  chunksDocTitle.value = `${row.docCode} · ${row.title}`
  chunkPagination.pageNum = 1
  chunksVisible.value = true
  fetchChunks()
}

const fetchChunks = async () => {
  if (!chunksDocId.value) return
  chunksLoading.value = true
  try {
    const response = await getKnowledgeDocumentChunks(chunksDocId.value, {
      pageNum: chunkPagination.pageNum,
      pageSize: chunkPagination.pageSize
    })
    const { rows, total } = normalizePageResponse(response)
    chunks.value = rows
    chunkPagination.total = total
  } finally {
    chunksLoading.value = false
  }
}

onMounted(async () => {
  await preload()
  await fetchDocuments()
})
</script>

<style scoped>
.page-shell { display: flex; flex-direction: column; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.page-header h2 { margin: 0 0 4px; }
.page-header p { margin: 0; color: #64748b; font-size: 0.9rem; }
.chunk-tag { margin-left: 6px; }
.hint { margin-left: 12px; color: #94a3b8; font-size: 0.8rem; }
.content-pre { margin: 0; white-space: pre-wrap; word-break: break-word; max-height: 320px; overflow: auto; font-family: inherit; }
.chunks-doc { margin-bottom: 12px; color: #475569; font-weight: 600; }
.chunk-content { display: inline-block; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
