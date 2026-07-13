<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>RAG 问答测试</h2>
        <p>基于 WMS 知识库进行规则问答。当前版本只使用静态知识，不查询实时库存、订单或流水。</p>
      </div>
    </div>

    <el-card shadow="never" class="ask-card">
      <el-form :model="form" label-width="90px" @submit.prevent>
        <el-form-item label="问题">
          <el-input
            v-model="form.question"
            type="textarea"
            :rows="3"
            placeholder="例如：为什么出库锁库后库存没有减少？"
            @keyup.enter.ctrl="ask"
          />
        </el-form-item>
        <div class="example-questions">
          <span class="example-label">示例问题：</span>
          <el-button
            v-for="example in exampleQuestions"
            :key="example"
            size="small"
            text
            type="primary"
            @click="useExample(example)"
          >{{ example }}</el-button>
        </div>
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
              <el-input-number v-model="form.topK" :min="1" :max="8" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" :disabled="!form.question.trim()" :loading="loading" @click="ask">提问</el-button>
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
      class="ask-alert"
    />

    <div v-if="answered" class="results">
      <el-card shadow="hover" class="answer-card">
        <template #header>
          <div class="answer-header">
            <span>模型回答</span>
            <el-tag v-if="result.model" size="small" type="success" effect="plain">{{ result.model }}</el-tag>
            <el-tag v-else size="small" type="info" effect="plain">未调用大模型</el-tag>
          </div>
        </template>
        <pre class="answer-text">{{ result.answer }}</pre>
      </el-card>

      <el-card shadow="hover" class="references-card">
        <template #header>
          <span>参考知识（{{ result.references.length }}）</span>
        </template>
        <div v-if="!result.references.length" class="no-hit">未命中知识</div>
        <div v-else>
          <div v-for="(ref, index) in result.references" :key="ref.chunkId" class="reference-item">
            <div class="reference-head">
              <span class="reference-title">#{{ index + 1 }} {{ ref.title }}</span>
              <el-tag type="success" effect="plain">score {{ formatScore(ref.score) }}</el-tag>
            </div>
            <div class="reference-tags">
              <el-tag size="small" effect="plain">{{ moduleLabel(ref.module) }}</el-tag>
              <el-tag size="small" type="info" effect="plain">{{ sourceTypeLabel(ref.sourceType) }}</el-tag>
              <el-tag v-if="ref.operationType" size="small" type="warning" effect="plain">{{ ref.operationType }}</el-tag>
            </div>
            <p class="reference-preview">{{ ref.contentPreview }}</p>
          </div>
        </div>
      </el-card>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useDict } from '../../composables/useDict'
import { askRag } from '../../api/aiRag'
import { unwrapApiData } from '../../utils/apiResponse'

const DICT_MODULE = 'ai_knowledge_module'
const DICT_SOURCE_TYPE = 'ai_knowledge_source_type'
const { preload, getDictLabel, getDictOptions } = useDict([DICT_MODULE, DICT_SOURCE_TYPE])

const moduleOptions = computed(() => getDictOptions(DICT_MODULE))
const moduleLabel = (value) => getDictLabel(DICT_MODULE, value)
const sourceTypeLabel = (value) => getDictLabel(DICT_SOURCE_TYPE, value)

const exampleQuestions = [
  '为什么出库锁库后库存没有减少？',
  '出库确认发货后库存怎么变化？',
  '库存有 100 件为什么不能出库？',
  '破损库存是不是应该直接调减？',
  '已发货出库单为什么不能取消？'
]

const form = reactive({ question: '', module: '', operationType: '', topK: 3 })
const loading = ref(false)
const answered = ref(false)
const errorMessage = ref('')
const result = ref({ answer: '', references: [], model: null })

const formatScore = (score) => (typeof score === 'number' ? score.toFixed(4) : score ?? '-')

const useExample = (question) => {
  form.question = question
}

const ask = async () => {
  if (!form.question.trim()) {
    errorMessage.value = '请输入问题'
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = {
      question: form.question.trim(),
      module: form.module || undefined,
      operationType: form.operationType || undefined,
      topK: form.topK
    }
    const data = unwrapApiData(await askRag(payload))
    result.value = {
      answer: data?.answer || '',
      references: data?.references || [],
      model: data?.model || null
    }
    answered.value = true
  } catch (error) {
    // Surface the backend's explicit error instead of pretending the question was answered.
    errorMessage.value = error?.response?.data?.message || error?.message || '问答请求失败'
    result.value = { answer: '', references: [], model: null }
    answered.value = false
  } finally {
    loading.value = false
  }
}

const reset = () => {
  form.question = ''
  form.module = ''
  form.operationType = ''
  form.topK = 3
  answered.value = false
  errorMessage.value = ''
  result.value = { answer: '', references: [], model: null }
}

onMounted(preload)
</script>

<style scoped>
.page-shell { display: flex; flex-direction: column; }
.page-header { margin-bottom: 12px; }
.page-header h2 { margin: 0 0 4px; }
.page-header p { margin: 0; color: #64748b; font-size: 0.9rem; }
.ask-card { margin-bottom: 16px; }
.ask-alert { margin-bottom: 16px; }
.example-questions { margin: -6px 0 12px 90px; display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.example-label { color: #94a3b8; font-size: 0.85rem; margin-right: 4px; }
.answer-card, .references-card { margin-bottom: 16px; }
.answer-header { display: flex; align-items: center; gap: 8px; }
.answer-text { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: inherit; color: #1e293b; line-height: 1.7; }
.no-hit { color: #94a3b8; padding: 8px 0; }
.reference-item { padding: 10px 0; border-bottom: 1px dashed #e5e7eb; }
.reference-item:last-child { border-bottom: none; }
.reference-head { display: flex; justify-content: space-between; align-items: center; }
.reference-title { font-weight: 600; }
.reference-tags { margin: 6px 0; display: flex; gap: 8px; flex-wrap: wrap; }
.reference-preview { margin: 0; color: #475569; font-size: 0.9rem; }
</style>
