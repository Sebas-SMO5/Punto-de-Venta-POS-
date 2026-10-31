import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'

import DashboardView from '../views/DashboardView.vue'
import SalesView from '../views/SalesView.vue'
import TablesView from '../views/TablesView.vue'
import ProductsView from '../views/ProductsView.vue'
import CategoriesView from '../views/CategoriesView.vue'
import InventoryView from '../views/InventoryView.vue'
import OrdersView from '../views/OrdersView.vue'
import SalesHistoryView from '../views/SalesHistoryView.vue'
import SyncView from '../views/SyncView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', name: 'dashboard', component: DashboardView },
        { path: 'sales', name: 'sales', component: SalesView },
        { path: 'tables', name: 'tables', component: TablesView },
        { path: 'products', name: 'products', component: ProductsView },
        { path: 'categories', name: 'categories', component: CategoriesView },
        { path: 'inventory', name: 'inventory', component: InventoryView },
        { path: 'orders', name: 'orders', component: OrdersView },
        { path: 'sales-history', name: 'sales-history', component: SalesHistoryView },
        { path: 'sync', name: 'sync', component: SyncView },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router