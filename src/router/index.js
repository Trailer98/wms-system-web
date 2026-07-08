import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue')
  },
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('../views/DashboardView.vue')
      },
      {
        path: 'warehouses',
        name: 'Warehouses',
        component: () => import('../views/WarehousesView.vue'),
        meta: { permission: 'warehouse:view' }
      },
      {
        path: 'skus',
        name: 'Skus',
        component: () => import('../views/SkusView.vue'),
        meta: { permission: 'sku:view' }
      },
      {
        path: 'customers',
        name: 'Customers',
        component: () => import('../views/CustomersView.vue'),
        meta: { permission: 'customer:view' }
      },
      {
        path: 'suppliers',
        name: 'Suppliers',
        component: () => import('../views/SuppliersView.vue'),
        meta: { permission: 'supplier:view' }
      },
      {
        path: 'warehouse-areas',
        name: 'WarehouseAreas',
        component: () => import('../views/WarehouseAreasView.vue'),
        meta: { permission: 'area:view' }
      },
      {
        path: 'warehouse-locations',
        name: 'WarehouseLocations',
        component: () => import('../views/WarehouseLocationsView.vue'),
        meta: { permission: 'location:view' }
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: () => import('../views/InventoryView.vue'),
        meta: { permission: 'inventory:view' }
      },
      {
        path: 'inventory/transactions',
        name: 'InventoryTransactions',
        component: () => import('../views/InventoryTransactionsView.vue'),
        meta: { permission: 'inventory:transaction:view' }
      },
      {
        path: 'stock-adjust-orders',
        name: 'StockAdjustOrders',
        component: () => import('../views/StockAdjustOrdersView.vue'),
        meta: { permission: 'stock-adjust:view' }
      },
      {
        path: 'stock-count-tasks',
        name: 'StockCountTasks',
        component: () => import('../views/StockCountTasksView.vue'),
        meta: { permission: 'stock-count:view' }
      },
      {
        path: 'inbound-orders',
        name: 'InboundOrders',
        component: () => import('../views/InboundOrdersView.vue'),
        meta: { permission: 'inbound:create' }
      },
      {
        path: 'inbound-orders/query',
        name: 'InboundOrderQuery',
        component: () => import('../views/InboundOrderQueryView.vue'),
        meta: { permission: 'inbound:view' }
      },
      {
        path: 'inbound-orders/:id',
        name: 'InboundOrderDetail',
        component: () => import('../views/InboundOrdersView.vue'),
        meta: { permission: 'inbound:view' }
      },
      {
        path: 'outbound-orders',
        name: 'OutboundOrders',
        component: () => import('../views/OutboundOrdersView.vue'),
        meta: { permission: 'outbound:create' }
      },
      {
        path: 'outbound-orders/query',
        name: 'OutboundOrderQuery',
        component: () => import('../views/OutboundOrderQueryView.vue'),
        meta: { permission: 'outbound:view' }
      },
      {
        path: 'outbound-orders/:id',
        name: 'OutboundOrderDetail',
        component: () => import('../views/OutboundOrdersView.vue'),
        meta: { permission: 'outbound:view' }
      },
      {
        path: 'users',
        name: 'SysUsers',
        component: () => import('../views/SysUsersView.vue'),
        meta: { permission: 'user:view' }
      },
      {
        path: 'roles',
        name: 'SysRoles',
        component: () => import('../views/SysRolesView.vue'),
        meta: { permission: 'role:view' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/SettingsView.vue')
      },
      {
        path: 'sys-dicts',
        name: 'SysDicts',
        component: () => import('../views/SysDictView.vue'),
        meta: { permission: 'sys-dict:view' }
      },
      {
        path: 'operation-logs',
        name: 'OperationLogs',
        component: () => import('../views/OperationLogsView.vue'),
        meta: { permission: 'operation-log:view' }
      },
      {
        path: 'wms-exceptions',
        name: 'WmsExceptions',
        component: () => import('../views/WmsExceptionEventsView.vue'),
        meta: { permission: 'exception:view' }
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('../views/NotFoundView.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  if (to.name === 'Login') {
    return true
  }

  const authStore = useAuthStore()
  if (!authStore.token) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }

  if (!authStore.user) {
    // Page was (re)loaded fresh: only the token survived, so re-hydrate roles/permissions before
    // any permission-gated route is evaluated below.
    try {
      const { api } = await import('../plugins/axios')
      const { unwrapApiData } = await import('../utils/apiResponse')
      const response = await api.get('/auth/me')
      authStore.setProfile(unwrapApiData(response))
    } catch (error) {
      return { name: 'Login', query: { redirect: to.fullPath } }
    }
  }

  if (to.meta?.permission && !authStore.hasPermission(to.meta.permission)) {
    return { name: 'Dashboard' }
  }

  return true
})

export default router
