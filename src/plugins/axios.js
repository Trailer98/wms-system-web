import axios from 'axios'
import { ElMessage } from 'element-plus'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

api.interceptors.request.use(
  (config) => {
    // 这里可统一添加授权 token 或其他请求头
    // const token = localStorage.getItem('token')
    // if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    // 优先读取响应体中的 message
    if (error.response && error.response.data && error.response.data.message) {
      ElMessage.error(error.response.data.message)
    } else if (error.response) {
      // 服务器响应了状态码但不是 2xx
      ElMessage.error(`错误: ${error.response.status} ${error.response.statusText}`)
    } else if (error.request) {
      // 请求已发出但没有收到响应
      ElMessage.error('无法连接到服务器，请检查后端地址是否正确')
    } else {
      ElMessage.error(error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default {
  install(app) {
    app.config.globalProperties.$axios = api
    app.provide('$axios', api)
  }
}
