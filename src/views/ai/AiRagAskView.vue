<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>RAG 问答测试</h2>
        <p>基于 WMS 知识库进行规则问答。当前版本只使用静态知识，不查询实时库存、订单或流水。</p>
      </div>
      <div v-if="audienceModeLabel" class="audience-mode-indicator">
        <el-tag :type="audienceMode === 'TECHNICAL_USER' ? 'warning' : 'success'" effect="dark">{{ audienceModeLabel }}</el-tag>
        <span class="hint">回答模式由当前登录用户角色自动决定</span>
      </div>
    </div>

    <div v-if="answerabilityLabel" class="debug-stats">
      <el-tag :type="answerabilityTagType" effect="plain">{{ answerabilityLabel }}</el-tag>
      <span class="debug-stat">topK：{{ topK ?? '-' }}</span>
      <span class="debug-stat">similarityThreshold：{{ similarityThreshold ?? '-' }}</span>
      <span class="debug-stat">rawHitCount：{{ rawHitCount }}</span>
      <span class="debug-stat">validHitCount：{{ validHitCount }}</span>
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
          <el-col :xs="24" :sm="6">
            <el-form-item label="模块">
              <el-select v-model="form.module" placeholder="全部模块" clearable filterable>
                <el-option v-for="o in moduleOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="6">
            <el-form-item label="操作类型">
              <el-input v-model="form.operationType" placeholder="如 OUTBOUND_LOCK" clearable />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="6">
            <el-form-item label="TopK">
              <el-input-number v-model="form.topK" :min="1" :max="8" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="6">
            <el-form-item label="流式回答">
              <el-switch v-model="streamEnabled" active-text="开启" inactive-text="关闭" :disabled="loading" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" :disabled="!form.question.trim()" :loading="loading" @click="ask">提问</el-button>
          <el-button v-if="streaming" @click="stopStreaming">停止生成</el-button>
          <el-button v-else @click="reset">清空</el-button>
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
            <el-tag v-if="streaming" size="small" type="warning" effect="plain">生成中...</el-tag>
            <el-tag v-else-if="model" size="small" type="success" effect="plain">{{ model }}</el-tag>
            <el-tag v-else size="small" type="info" effect="plain">未调用大模型</el-tag>
          </div>
        </template>
        <div class="markdown-body" v-html="renderedAnswer"></div>
      </el-card>

      <el-card shadow="hover" class="references-card">
        <template #header>
          <span>参考知识（{{ references.length }}）</span>
        </template>
        <div v-if="answerability === 'NOT_FOUND'" class="no-hit">
          未命中足够相关的知识（rawHitCount={{ rawHitCount }}，均低于 similarityThreshold={{ similarityThreshold }}，已全部过滤，不作为参考知识展示）
        </div>
        <div v-else-if="!references.length" class="no-hit">未命中知识</div>
        <div v-else>
          <div v-for="(ref, index) in references" :key="ref.chunkId" class="reference-item">
            <div class="reference-head">
              <span class="reference-title">#{{ index + 1 }} {{ ref.title }}</span>
              <el-tag type="success" effect="plain">相似度 {{ formatScore(ref.similarityScore) }}</el-tag>
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
import { useAuthStore } from '../../stores/auth'
import { askRag } from '../../api/aiRag'
import { unwrapApiData } from '../../utils/apiResponse'
import { renderMarkdown } from '../../utils/markdown'
import { parseSseJson, SseParser } from '../../utils/sse'

const STREAM_URL = '/api/ai/rag/ask/stream'

const DICT_MODULE = 'ai_knowledge_module'
const DICT_SOURCE_TYPE = 'ai_knowledge_source_type'
const { preload, getDictLabel, getDictOptions } = useDict([DICT_MODULE, DICT_SOURCE_TYPE])
const authStore = useAuthStore()

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
const streamEnabled = ref(true)
const loading = ref(false)
const streaming = ref(false)
const answered = ref(false)
const errorMessage = ref('')

// answerRaw is the Markdown source (grows incrementally while streaming); renderedAnswer is the
// sanitized HTML derived from it — the template only ever v-html's the derived value, never the raw
// Markdown/model output directly.
const answerRaw = ref('')
const renderedAnswer = computed(() => renderMarkdown(answerRaw.value))
const references = ref([])
const model = ref(null)

// Decided entirely by the backend from the current user's roles (DEVELOPER => technical mode) — never
// settable here. Sticky across questions in the same session (it reflects who's logged in, not the
// specific question), so it isn't cleared by resetResults()/reset().
const audienceMode = ref(null)
const audienceModeLabel = ref('')

// Retrieval/threshold diagnostics returned by the backend alongside each answer — reflect the
// actual topK/threshold the backend applied and the raw-vs-filtered hit counts, not the request form.
const answerability = ref(null)
const answerabilityLabel = ref('')
const topK = ref(null)
const similarityThreshold = ref(null)
const rawHitCount = ref(0)
const validHitCount = ref(0)

const answerabilityTagType = computed(() => (answerability.value === 'ANSWERABLE' ? 'success' : 'info'))

let abortController = null

const formatScore = (score) => (typeof score === 'number' ? score.toFixed(4) : score ?? '-')

const useExample = (question) => {
  form.question = question
}

const buildPayload = () => ({
  question: form.question.trim(),
  module: form.module || undefined,
  operationType: form.operationType || undefined,
  topK: form.topK
})

const resetResults = () => {
  answerRaw.value = ''
  references.value = []
  model.value = null
  errorMessage.value = ''
  answerability.value = null
  answerabilityLabel.value = ''
  topK.value = null
  similarityThreshold.value = null
  rawHitCount.value = 0
  validHitCount.value = 0
}

const ask = () => {
  if (!form.question.trim()) {
    errorMessage.value = '请输入问题'
    return
  }
  resetResults()
  answered.value = true
  loading.value = true
  if (streamEnabled.value) {
    askStream()
  } else {
    askNonStream()
  }
}

const askNonStream = async () => {
  try {
    const data = unwrapApiData(await askRag(buildPayload()))
    answerRaw.value = data?.answer || ''
    references.value = data?.references || []
    model.value = data?.model || null
    audienceMode.value = data?.audienceMode || null
    audienceModeLabel.value = data?.audienceModeLabel || ''
    answerability.value = data?.answerability || null
    answerabilityLabel.value = data?.answerabilityLabel || ''
    topK.value = data?.topK ?? null
    similarityThreshold.value = data?.similarityThreshold ?? null
    rawHitCount.value = data?.rawHitCount ?? 0
    validHitCount.value = data?.validHitCount ?? 0
  } catch (error) {
    // Surface the backend's explicit error instead of pretending the question was answered.
    errorMessage.value = error?.response?.data?.message || error?.message || '问答请求失败'
    answered.value = false
  } finally {
    loading.value = false
  }
}

const askStream = async () => {
  streaming.value = true
  abortController = new AbortController()
  const parser = new SseParser()

  try {
    const response = await fetch(STREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {})
      },
      body: JSON.stringify(buildPayload()),
      signal: abortController.signal
    })

    if (!response.ok) {
      const bodyText = await response.text()
      const parsedBody = parseSseJson(bodyText)
      throw new Error(parsedBody?.message || `请求失败（HTTP ${response.status}）`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const events = parser.push(decoder.decode(value, { stream: true }))
        for (const evt of events) {
          handleStreamEvent(evt)
        }
      }
    } finally {
      reader.releaseLock()
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      // User clicked "停止生成" — not a failure, leave whatever partial answer was received.
      return
    }
    // Streaming failed (network error, connection reset, etc.) — tell the user to retry without
    // streaming rather than silently falling back and re-invoking the model automatically.
    errorMessage.value = (error?.message || '流式问答请求失败') + '，请关闭"流式回答"后重试'
  } finally {
    loading.value = false
    streaming.value = false
    abortController = null
  }
}

const handleStreamEvent = (evt) => {
  const data = parseSseJson(evt.data)
  if (!data) return
  switch (evt.event) {
    case 'meta':
      audienceMode.value = data.audienceMode || null
      audienceModeLabel.value = data.audienceModeLabel || ''
      answerability.value = data.answerability || null
      answerabilityLabel.value = data.answerabilityLabel || ''
      topK.value = data.topK ?? null
      similarityThreshold.value = data.similarityThreshold ?? null
      rawHitCount.value = data.rawHitCount ?? 0
      validHitCount.value = data.validHitCount ?? 0
      break
    case 'references':
      references.value = data.references || []
      break
    case 'delta':
      if (typeof data.text === 'string') {
        answerRaw.value += data.text
      }
      break
    case 'done':
      if (typeof data.answer === 'string' && data.answer) {
        answerRaw.value = data.answer
      }
      model.value = data.model || null
      // done repeats audienceMode as a final calibration point (spec: mainly relevant if meta was
      // somehow missed) — harmless to reapply even when it already matches what meta set.
      if (data.audienceMode) {
        audienceMode.value = data.audienceMode
        audienceModeLabel.value = data.audienceModeLabel || audienceModeLabel.value
      }
      break
    case 'error':
      errorMessage.value = data.message || '生成回答失败'
      break
    default:
      break
  }
}

const stopStreaming = () => {
  abortController?.abort()
}

const reset = () => {
  form.question = ''
  form.module = ''
  form.operationType = ''
  form.topK = 3
  answered.value = false
  resetResults()
}

onMounted(preload)
</script>

<style scoped>
.page-shell { display: flex; flex-direction: column; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.page-header h2 { margin: 0 0 4px; }
.page-header p { margin: 0; color: #64748b; font-size: 0.9rem; }
.audience-mode-indicator { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.hint { color: #94a3b8; font-size: 0.8rem; }
.debug-stats { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; padding: 6px 10px; background: #f8fafc; border: 1px dashed #e2e8f0; border-radius: 6px; }
.debug-stat { color: #64748b; font-size: 0.82rem; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
.ask-card { margin-bottom: 16px; }
.ask-alert { margin-bottom: 16px; }
.example-questions { margin: -6px 0 12px 90px; display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.example-label { color: #94a3b8; font-size: 0.85rem; margin-right: 4px; }
.answer-card, .references-card { margin-bottom: 16px; }
.answer-header { display: flex; align-items: center; gap: 8px; }
.no-hit { color: #94a3b8; padding: 8px 0; }
.reference-item { padding: 10px 0; border-bottom: 1px dashed #e5e7eb; }
.reference-item:last-child { border-bottom: none; }
.reference-head { display: flex; justify-content: space-between; align-items: center; }
.reference-title { font-weight: 600; }
.reference-tags { margin: 6px 0; display: flex; gap: 8px; flex-wrap: wrap; }
.reference-preview { margin: 0; color: #475569; font-size: 0.9rem; }

/* Basic Markdown rendering, styled to match the rest of the Element Plus-driven page. */
.markdown-body {
  line-height: 1.7;
  color: #1e293b;
  word-break: break-word;
}
.markdown-body :deep(h2) {
  margin: 16px 0 8px;
  font-size: 1.15rem;
  font-weight: 700;
}
.markdown-body :deep(h3) {
  margin: 14px 0 6px;
  font-size: 1.05rem;
  font-weight: 600;
}
.markdown-body :deep(p) {
  margin: 0 0 10px;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 10px;
  padding-left: 22px;
}
.markdown-body :deep(li) {
  margin: 4px 0;
}
.markdown-body :deep(strong) {
  font-weight: 700;
}
.markdown-body :deep(code) {
  background: #f1f5f9;
  color: #b91c1c;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 0.9em;
}
.markdown-body :deep(pre) {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
}
.markdown-body :deep(pre code) {
  background: none;
  color: inherit;
  padding: 0;
}
</style>
