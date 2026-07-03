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
        path: 'inventory',
        name: 'Inventory',
        component: () => import('../views/InventoryView.vue')
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
