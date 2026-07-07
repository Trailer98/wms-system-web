<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>仪表盘</h2>
        <p>进入常用业务页面，完成基础资料维护、库存查询和出入库作业。</p>
      </div>
    </div>

    <div class="dashboard-grid">
      <router-link v-for="item in entries" :key="item.path" class="dashboard-entry" :to="item.path">
        <strong>{{ item.title }}</strong>
        <span>{{ item.description }}</span>
      </router-link>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

// Mirrors router/index.js meta.permission for each target route, so a card is only offered here
// if the user could actually land on it (kept in sync manually since routes are static).
const allEntries = [
  { title: '仓库管理', description: '新增仓库并查询仓库档案', path: '/warehouses', permission: 'warehouse:view' },
  { title: 'SKU 管理', description: '维护 SKU 编码、名称、单位和品类', path: '/skus', permission: 'sku:view' },
  { title: '客户管理', description: '维护客户档案和联系方式', path: '/customers' },
  { title: '供应商管理', description: '维护供应商档案和联系方式', path: '/suppliers' },
  { title: '库存查询', description: '查看现存量、占用量和可用量', path: '/inventory', permission: 'inventory:view' },
  { title: '入库作业', description: '创建入库单', path: '/inbound-orders', permission: 'inbound:create' },
  { title: '入库单查询', description: '查询入库单并执行收货', path: '/inbound-orders/query', permission: 'inbound:view' },
  { title: '出库作业', description: '创建出库单', path: '/outbound-orders', permission: 'outbound:create' },
  { title: '出库单查询', description: '查询出库单并执行发货', path: '/outbound-orders/query', permission: 'outbound:view' },
  { title: '日志查询', description: '追踪业务操作记录', path: '/operation-logs' }
]

const entries = computed(() => allEntries.filter((entry) => !entry.permission || authStore.hasPermission(entry.permission)))
</script>

<style scoped>
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.dashboard-entry {
  min-height: 112px;
  padding: 18px;
  color: #111827;
  text-decoration: none;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.dashboard-entry:hover {
  border-color: #2563eb;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.12);
}

.dashboard-entry strong {
  display: block;
  margin-bottom: 10px;
  font-size: 16px;
}

.dashboard-entry span {
  color: #64748b;
  line-height: 1.6;
}
</style>
