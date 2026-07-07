<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">WMS System</h1>
      <p class="login-subtitle">仓储管理系统</p>

      <el-form :model="form" :rules="rules" ref="formRef" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" class="login-button" :loading="loading" @click="handleLogin">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { inject, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { unwrapApiData } from '../utils/apiResponse'

const axios = inject('$axios')
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const response = await axios.post('/auth/login', form)
    const data = unwrapApiData(response)
    authStore.setSession(data)
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e293b, #334155);
}

.login-card {
  width: 360px;
  padding: 40px 32px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.login-title {
  margin: 0;
  font-size: 1.5rem;
  color: #1e293b;
  text-align: center;
}

.login-subtitle {
  margin: 4px 0 24px;
  color: #64748b;
  text-align: center;
}

.login-button {
  width: 100%;
}
</style>
