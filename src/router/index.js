import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'

const routes = [
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
        component: () => import('../views/WarehousesView.vue')
      },
      {
        path: 'skus',
        name: 'Skus',
        component: () => import('../views/SkusView.vue')
      },
      {
        path: 'customers',
        name: 'Customers',
        component: () => import('../views/CustomersView.vue')
      },
      {
        path: 'suppliers',
        name: 'Suppliers',
        component: () => import('../views/SuppliersView.vue')
      },
      {
        path: 'warehouse-areas',
        name: 'WarehouseAreas',
        component: () => import('../views/WarehouseAreasView.vue')
      },
      {
        path: 'warehouse-locations',
        name: 'WarehouseLocations',
        component: () => import('../views/WarehouseLocationsView.vue')
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: () => import('../views/InventoryView.vue')
      },
      {
        path: 'inventory/transactions',
        name: 'InventoryTransactions',
        component: () => import('../views/InventoryTransactionsView.vue')
      },
      {
        path: 'inbound-orders',
        name: 'InboundOrders',
        component: () => import('../views/InboundOrdersView.vue')
      },
      {
        path: 'inbound-orders/query',
        name: 'InboundOrderQuery',
        component: () => import('../views/InboundOrderQueryView.vue')
      },
      {
        path: 'inbound-orders/:id',
        name: 'InboundOrderDetail',
        component: () => import('../views/InboundOrdersView.vue')
      },
      {
        path: 'outbound-orders',
        name: 'OutboundOrders',
        component: () => import('../views/OutboundOrdersView.vue')
      },
      {
        path: 'outbound-orders/query',
        name: 'OutboundOrderQuery',
        component: () => import('../views/OutboundOrderQueryView.vue')
      },
      {
        path: 'outbound-orders/:id',
        name: 'OutboundOrderDetail',
        component: () => import('../views/OutboundOrdersView.vue')
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/SettingsView.vue')
      },
      {
        path: 'operation-logs',
        name: 'OperationLogs',
        component: () => import('../views/OperationLogsView.vue')
      },
      {
        path: 'wms-exceptions',
        name: 'WmsExceptions',
        component: () => import('../views/WmsExceptionEventsView.vue')
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

export default router
