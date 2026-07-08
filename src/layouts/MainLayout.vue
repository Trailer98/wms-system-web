<template>
  <div class="main-layout">
    <header class="layout-header">
      <div class="logo">WMS System</div>
      <nav class="top-nav">
        <router-link to="/">首页</router-link>
        <router-link v-if="authStore.hasPermission('warehouse:view')" to="/warehouses">仓库</router-link>
        <router-link v-if="authStore.hasPermission('sku:view')" to="/skus">SKU</router-link>
        <router-link v-if="authStore.hasPermission('inventory:view')" to="/inventory">库存</router-link>
        <router-link v-if="authStore.hasPermission('operation-log:view')" to="/operation-logs">日志查询</router-link>
        <router-link to="/settings">设置</router-link>
      </nav>
      <div class="user-area">
        <span class="user-name">{{ authStore.user?.realName || authStore.user?.username }}</span>
        <el-button text @click="handleLogout">退出登录</el-button>
      </div>
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
            <el-menu-item v-if="authStore.hasPermission('warehouse:view')" index="/warehouses">仓库管理</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('area:view')" index="/warehouse-areas">库区管理</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('location:view')" index="/warehouse-locations">库位管理</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('sku:view')" index="/skus">SKU 管理</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('customer:view')" index="/customers">客户管理</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('supplier:view')" index="/suppliers">供应商管理</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="inventory-mgmt" v-if="showInventoryGroup">
            <template #title>库存管理</template>
            <el-menu-item v-if="authStore.hasPermission('inventory:view')" index="/inventory">库存查询</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('inventory:transaction:view')" index="/inventory/transactions">库存流水</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('stock-adjust:view')" index="/stock-adjust-orders">库存调整</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('stock-count:view')" index="/stock-count-tasks">库存盘点</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="inbound-mgmt" v-if="showInboundGroup">
            <template #title>入库管理</template>
            <el-menu-item v-if="authStore.hasPermission('inbound:create')" index="/inbound-orders">入库作业</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('inbound:view')" index="/inbound-orders/query">入库单查询</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="outbound-mgmt" v-if="showOutboundGroup">
            <template #title>出库管理</template>
            <el-menu-item v-if="authStore.hasPermission('outbound:create')" index="/outbound-orders">出库作业</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('outbound:view')" index="/outbound-orders/query">出库查询</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="system-mgmt">
            <template #title>系统管理</template>
            <el-menu-item v-if="authStore.hasPermission('operation-log:view')" index="/operation-logs">日志查询</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('exception:view')" index="/wms-exceptions">异常事件查询</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('user:view')" index="/users">用户管理</el-menu-item>
            <el-menu-item v-if="authStore.hasPermission('role:view')" index="/roles">角色管理</el-menu-item>
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
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const menuGroups = [
  { index: 'basic-info', paths: ['/warehouses', '/warehouse-areas', '/warehouse-locations', '/skus', '/customers', '/suppliers'] },
  { index: 'inventory-mgmt', paths: ['/inventory', '/inventory/transactions', '/stock-adjust-orders', '/stock-count-tasks'] },
  { index: 'inbound-mgmt', paths: ['/inbound-orders', '/inbound-orders/query'] },
  { index: 'outbound-mgmt', paths: ['/outbound-orders', '/outbound-orders/query'] },
  { index: 'system-mgmt', paths: ['/operation-logs', '/wms-exceptions', '/settings', '/users', '/roles'] }
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

// 基础信息管理 always shows: at least one item (warehouse/area/location/sku) is visible to every
// seeded role. The other groups are fully permission-gated per item, so hide the group itself
// once nothing inside it would render.
const showInventoryGroup = computed(() =>
  authStore.hasPermission('inventory:view') || authStore.hasPermission('inventory:transaction:view') ||
  authStore.hasPermission('stock-adjust:view') || authStore.hasPermission('stock-count:view'))
const showInboundGroup = computed(() =>
  authStore.hasPermission('inbound:create') || authStore.hasPermission('inbound:view'))
const showOutboundGroup = computed(() =>
  authStore.hasPermission('outbound:create') || authStore.hasPermission('outbound:view'))

const handleLogout = async () => {
  authStore.clear()
  router.replace({ name: 'Login' })
}
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

.user-area {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}

.user-name {
  color: #e2e8f0;
  font-size: 0.9rem;
}

.user-area :deep(.el-button) {
  color: #cbd5e1;
}

.user-area :deep(.el-button:hover) {
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
