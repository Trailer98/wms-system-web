import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import axiosPlugin from './plugins/axios'
import './style.css'

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.use(createPinia())
app.use(axiosPlugin)
app.mount('#app')
