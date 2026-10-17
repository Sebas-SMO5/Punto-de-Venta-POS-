import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import DashboardView from '../views/DashboardView.vue'
import SalesView from '../views/SalesView.vue'
import TablesView from '../views/TablesView.vue'
import ProductsView from '../views/ProductsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: DashboardView,
        },
        {
          path: 'sales',
          name: 'sales',
          component: SalesView,
        },
        {
          path: 'tables',
          name: 'tables',
          component: TablesView,
        },
        {
          path: 'products',
          name: 'products',
          component: ProductsView,
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router