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
const entries = [
  { title: '仓库管理', description: '新增仓库并查询仓库档案', path: '/warehouses' },
  { title: 'SKU 管理', description: '维护 SKU 编码、名称、单位和品类', path: '/skus' },
  { title: '库存查询', description: '查看现存量、占用量和可用量', path: '/inventory' },
  { title: '入库作业', description: '创建入库单并执行收货', path: '/inbound-orders' },
  { title: '出库作业', description: '创建出库单并执行发货', path: '/outbound-orders' },
  { title: '日志查询', description: '追踪业务操作记录', path: '/operation-logs' }
]
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
