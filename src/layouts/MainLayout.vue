<template>
  <div class="main-layout">
    <header class="layout-header">
      <div class="logo">WMS System</div>
      <nav class="top-nav">
        <router-link to="/">首页</router-link>
        <router-link to="/warehouses">仓库</router-link>
        <router-link to="/skus">SKU</router-link>
        <router-link to="/inventory">库存</router-link>
        <router-link to="/operation-logs">日志查询</router-link>
        <router-link to="/settings">设置</router-link>
      </nav>
    </header>

    <div class="layout-body">
      <aside class="layout-sidebar">
        <el-menu
          router
          :default-active="activeMenuPath"
          :default-openeds="activeGroups"
          background-color="#1e293b"
          text-color="#cbd5e1"
          active-text-color="#ffffff"
          class="layout-menu"
        >
          <el-menu-item index="/">仪表盘</el-menu-item>

          <el-sub-menu index="basic-info">
            <template #title>基础信息管理</template>
            <el-menu-item index="/warehouses">仓库管理</el-menu-item>
            <el-menu-item index="/warehouse-areas">库区管理</el-menu-item>
            <el-menu-item index="/warehouse-locations">库位管理</el-menu-item>
            <el-menu-item index="/skus">SKU 管理</el-menu-item>
            <el-menu-item index="/customers">客户管理</el-menu-item>
            <el-menu-item index="/suppliers">供应商管理</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="inventory-mgmt">
            <template #title>库存管理</template>
            <el-menu-item index="/inventory">库存查询</el-menu-item>
            <el-menu-item index="/inventory/transactions">库存流水</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="inbound-mgmt">
            <template #title>入库管理</template>
            <el-menu-item index="/inbound-orders">入库作业</el-menu-item>
            <el-menu-item index="/inbound-orders/query">入库单查询</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="outbound-mgmt">
            <template #title>出库管理</template>
            <el-menu-item index="/outbound-orders">出库作业</el-menu-item>
            <el-menu-item index="/outbound-orders/query">出库查询</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="system-mgmt">
            <template #title>系统管理</template>
            <el-menu-item index="/operation-logs">日志查询</el-menu-item>
            <el-menu-item index="/wms-exceptions">异常事件查询</el-menu-item>
            <el-menu-item index="/settings">系统设置</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </aside>

      <main class="layout-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const menuGroups = [
  { index: 'basic-info', paths: ['/warehouses', '/warehouse-areas', '/warehouse-locations', '/skus', '/customers', '/suppliers'] },
  { index: 'inventory-mgmt', paths: ['/inventory', '/inventory/transactions'] },
  { index: 'inbound-mgmt', paths: ['/inbound-orders', '/inbound-orders/query'] },
  { index: 'outbound-mgmt', paths: ['/outbound-orders', '/outbound-orders/query'] },
  { index: 'system-mgmt', paths: ['/operation-logs', '/wms-exceptions', '/settings'] }
]

const activeMenuPath = computed(() => {
  if (/^\/inbound-orders\/\d+$/.test(route.path)) return '/inbound-orders'
  if (/^\/outbound-orders\/\d+$/.test(route.path)) return '/outbound-orders'
  return route.path
})

const activeGroups = computed(() => {
  const group = menuGroups.find((item) => item.paths.includes(activeMenuPath.value))
  return group ? [group.index] : []
})
</script>

<style scoped>
.main-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f4f6fb;
}

.layout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 64px;
  background: #334155;
  color: #fff;
}

.logo {
  font-size: 1.1rem;
  font-weight: 700;
}

.top-nav a {
  color: #cbd5e1;
  margin-left: 20px;
  text-decoration: none;
  white-space: nowrap;
}

.top-nav a.router-link-exact-active {
  color: #fff;
  font-weight: 600;
}

.top-nav a:hover {
  color: #fff;
}

.layout-body {
  display: flex;
  flex: 1;
}

.layout-sidebar {
  width: 220px;
  background: #1e293b;
  color: #cbd5e1;
}

.layout-menu {
  border-right: none;
}

.layout-content {
  flex: 1;
  padding: 24px;
  background: #eef2ff;
  min-width: 0;
}

@media (max-width: 960px) {
  .layout-header {
    align-items: flex-start;
    flex-direction: column;
    height: auto;
    gap: 10px;
    padding: 14px 16px;
  }

  .top-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
  }

  .top-nav a {
    margin-left: 0;
  }

  .layout-body {
    flex-direction: column;
  }

  .layout-sidebar {
    width: 100%;
  }

  .layout-content {
    padding: 16px;
  }
}
</style>
