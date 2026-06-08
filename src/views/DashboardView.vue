<template>
  <section class="view-page">
    <h2>仪表盘</h2>
    <p>欢迎来到 WMS 系统仪表盘。</p>

    <div class="button-group">
      <button type="button" @click="requestSuccess">请求 success</button>
      <button type="button" @click="requestFail">请求 fail</button>
    </div>

    <p v-if="message" class="message">{{ message }}</p>
  </section>
</template>

<script setup>
import { inject, ref } from 'vue'

const axios = inject('$axios')
const message = ref('')

const requestSuccess = async () => {
  message.value = ''
  try {
    const response = await axios.get('/success')
    message.value = response.data?.message || '请求 success 成功'
  } catch (error) {
    message.value = error.response?.data?.message || error.message || '请求 success 失败'
  }
}

const requestFail = async () => {
  message.value = ''
  try {
    const response = await axios.get('/fail')
    message.value = response.data?.message || '请求 fail 成功'
  } catch (error) {
    message.value = error.response?.data?.message || error.message || '请求 fail 失败'
  }
}
</script>

<style scoped>
.view-page {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

.button-group {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

.button-group button {
  padding: 10px 18px;
  border: none;
  border-radius: 6px;
  background: #3b82f6;
  color: #fff;
  cursor: pointer;
}

.button-group button:hover {
  background: #2563eb;
}

.message {
  margin-top: 16px;
  color: #1f2937;
}
</style>
