<template>
  <el-form
    class="common-query-form"
    :model="model"
    :label-width="labelWidth"
    @submit.prevent
  >
    <el-row :gutter="gutter">
      <el-col
        v-for="field in fields"
        :key="field.prop"
        v-bind="field.col || defaultCol"
      >
        <el-form-item :label="field.label" :prop="field.prop">
          <el-input
            v-if="field.type === 'input'"
            :model-value="getFieldValue(field)"
            :clearable="field.clearable ?? true"
            :placeholder="field.placeholder"
            v-bind="field.attrs"
            @blur="trimField(field)"
            @keyup.enter="emitSearch"
            @update:model-value="(value) => setFieldValue(field, value)"
          />

          <el-select
            v-else-if="field.type === 'select'"
            :model-value="getFieldValue(field)"
            :clearable="field.clearable ?? true"
            :placeholder="field.placeholder"
            v-bind="field.attrs"
            @update:model-value="(value) => setFieldValue(field, value)"
          >
            <el-option
              v-for="option in field.options || []"
              :key="option.value"
              :label="option.label"
              :value="option.value"
              :disabled="option.disabled"
            />
          </el-select>

          <el-date-picker
            v-else-if="field.type === 'date-picker'"
            :model-value="getFieldValue(field)"
            :clearable="field.clearable ?? true"
            :placeholder="field.placeholder"
            v-bind="field.attrs"
            @update:model-value="(value) => setFieldValue(field, value)"
          />
        </el-form-item>
      </el-col>

      <el-col v-bind="actionCol">
        <el-form-item class="common-query-form__actions">
          <el-button type="primary" :loading="loading" @click="emitSearch">
            {{ searchText }}
          </el-button>
          <el-button @click="emitReset">{{ resetText }}</el-button>
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>

<script setup>
const props = defineProps({
  model: {
    type: Object,
    required: true
  },
  fields: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  labelWidth: {
    type: String,
    default: '80px'
  },
  gutter: {
    type: Number,
    default: 16
  },
  defaultCol: {
    type: Object,
    default: () => ({
      xs: 24,
      sm: 12,
      md: 8,
      lg: 6
    })
  },
  actionCol: {
    type: Object,
    default: () => ({
      xs: 24,
      md: 12
    })
  },
  searchText: {
    type: String,
    default: '查询'
  },
  resetText: {
    type: String,
    default: '重置'
  }
})

const emit = defineEmits(['search', 'reset'])

const getFieldValue = (field) => props.model[field.prop]

const setFieldValue = (field, value) => {
  props.model[field.prop] = value
}

const trimField = (field) => {
  if (!field.trim || typeof props.model[field.prop] !== 'string') return
  props.model[field.prop] = props.model[field.prop].trim()
}

const emitSearch = () => {
  props.fields.forEach(trimField)
  emit('search')
}

const emitReset = () => {
  emit('reset')
}
</script>

<style scoped>
.common-query-form {
  padding: 18px 18px 2px;
  margin-bottom: 18px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.common-query-form :deep(.el-date-editor) {
  width: 100%;
}

.common-query-form :deep(.el-select) {
  width: 100%;
}

.common-query-form__actions :deep(.el-form-item__content) {
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .common-query-form__actions :deep(.el-form-item__content) {
    justify-content: flex-start;
  }
}
</style>
