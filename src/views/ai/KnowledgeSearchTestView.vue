<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>知识检索测试</h2>
        <p>仅测试知识库向量检索（不调用聊天、不查询实时库存 / 订单 / 流水）。用于验证分片与向量索引质量。</p>
      </div>
    </div>

    <el-card shadow="never" class="search-card">
      <el-form :model="form" label-width="90px" @submit.prevent>
        <el-form-item label="检索内容">
          <el-input
            v-model="form.query"
            type="textarea"
            :rows="3"
            placeholder="如：为什么出库锁库后库存没有减少？"
            @keyup.enter.ctrl="runSearch"
          />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="8">
            <el-form-item label="模块">
              <el-select v-model="form.module" placeholder="全部模块" clearable filterable>
                <el-option v-for="o in moduleOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="操作类型">
              <el-input v-model="form.operationType" placeholder="如 OUTBOUND_LOCK" clearable />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="TopK">
              <el-input-number v-model="form.topK" :min="1" :max="20" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="runSearch">检索</el-button>
          <el-button @click="reset">清空</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="error"
      show-icon
      :closable="false"
      class="search-alert"
    />

    <div v-if="searched && !errorMessage" class="results">
      <div class="results-meta">命中 {{ results.length }} 条{{ results.length ? '' : '（无匹配结果）' }}</div>
      <el-card v-for="(hit, index) in results" :key="hit.chunkId" shadow="hover" class="result-card">
        <div class="result-head">
          <span class="result-title">#{{ index + 1 }} {{ hit.title }}</span>
          <el-tag type="success" effect="plain">score {{ formatScore(hit.score) }}</el-tag>
        </div>
        <div class="result-tags">
          <el-tag size="small" effect="plain">{{ moduleLabel(hit.module) }}</el-tag>
          <el-tag size="small" type="info" effect="plain">{{ sourceTypeLabel(hit.sourceType) }}</el-tag>
          <el-tag v-if="hit.operationType" size="small" type="warning" effect="plain">{{ hit.operationType }}</el-tag>
        </div>
        <pre class="result-content">{{ hit.content }}</pre>
      </el-card>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useDict } from '../../composables/useDict'
import { searchKnowledge } from '../../api/aiKnowledge'
import { unwrapApiData } from '../../utils/apiResponse'

const DICT_MODULE = 'ai_knowledge_module'
const DICT_SOURCE_TYPE = 'ai_knowledge_source_type'
const { preload, getDictLabel, getDictOptions } = useDict([DICT_MODULE, DICT_SOURCE_TYPE])

const moduleOptions = computed(() => getDictOptions(DICT_MODULE))
const moduleLabel = (value) => getDictLabel(DICT_MODULE, value)
const sourceTypeLabel = (value) => getDictLabel(DICT_SOURCE_TYPE, value)

const form = reactive({ query: '', module: '', operationType: '', topK: 5 })
const loading = ref(false)
const searched = ref(false)
const results = ref([])
const errorMessage = ref('')

const formatScore = (score) => (typeof score === 'number' ? score.toFixed(4) : score ?? '-')

const runSearch = async () => {
  if (!form.query.trim()) {
    errorMessage.value = '请输入检索内容'
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = {
      query: form.query.trim(),
      module: form.module || undefined,
      operationType: form.operationType || undefined,
      topK: form.topK
    }
    const data = unwrapApiData(await searchKnowledge(payload))
    results.value = data?.records || []
    searched.value = true
  } catch (error) {
    // Surface the backend's explicit error (e.g. vector store unavailable) instead of faking success.
    errorMessage.value = error?.response?.data?.message || error?.message || '检索失败'
    results.value = []
    searched.value = true
  } finally {
    loading.value = false
  }
}

const reset = () => {
  form.query = ''
  form.module = ''
  form.operationType = ''
  form.topK = 5
  results.value = []
  searched.value = false
  errorMessage.value = ''
}

onMounted(preload)
</script>

<style scoped>
.page-shell { display: flex; flex-direction: column; }
.page-header { margin-bottom: 12px; }
.page-header h2 { margin: 0 0 4px; }
.page-header p { margin: 0; color: #64748b; font-size: 0.9rem; }
.search-card { margin-bottom: 16px; }
.search-alert { margin-bottom: 16px; }
.results-meta { margin-bottom: 12px; color: #475569; }
.result-card { margin-bottom: 12px; }
.result-head { display: flex; justify-content: space-between; align-items: center; }
.result-title { font-weight: 600; }
.result-tags { margin: 8px 0; display: flex; gap: 8px; flex-wrap: wrap; }
.result-content { margin: 0; white-space: pre-wrap; word-break: break-word; color: #334155; background: #f8fafc; padding: 10px; border-radius: 6px; max-height: 260px; overflow: auto; font-family: inherit; }
</style>
