// Rutas (pantallas) de la aplicación y quién puede entrar a cada una.
//
// meta.public -> se puede ver sin iniciar sesión (solo el login)
// meta.roles  -> roles que pueden entrar; si no se indica, entran todos
//
// La protección (Navigation Guard) es ASÍNCRONA: antes de mostrar una
// pantalla espera a confirmar la sesión con el servidor (renovando el
// token con la cookie si hace falta).
//
// Todas las pantallas se cargan desde el inicio (sin carga diferida) para
// que el Service Worker las tenga guardadas y funcionen sin conexión.
import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import SalesView from '../views/SalesView.vue'
import TablesView from '../views/TablesView.vue'
import ProductsView from '../views/ProductsView.vue'
import CategoriesView from '../views/CategoriesView.vue'
import InventoryView from '../views/InventoryView.vue'
import OrdersView from '../views/OrdersView.vue'
import SalesHistoryView from '../views/SalesHistoryView.vue'
import SyncView from '../views/SyncView.vue'
import SessionsView from '../views/SessionsView.vue'
import UsersView from '../views/UsersView.vue'
import { useAuthStore } from '../stores/auth'
import type { Role } from '../types/models'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    roles?: Role[]
    title?: string
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: DashboardView,
          meta: { title: 'Panel de control' },
        },
        {
          path: 'sales',
          name: 'sales',
          component: SalesView,
          meta: { title: 'Punto de venta' },
        },
        {
          path: 'tables',
          name: 'tables',
          component: TablesView,
          meta: { title: 'Mesas' },
        },
        {
          path: 'products',
          name: 'products',
          component: ProductsView,
          meta: { title: 'Productos' },
        },
        {
          path: 'categories',
          name: 'categories',
          component: CategoriesView,
          meta: { title: 'Categorías', roles: ['admin'] },
        },
        {
          path: 'inventory',
          name: 'inventory',
          component: InventoryView,
          meta: { title: 'Inventario', roles: ['admin', 'cashier'] },
        },
        {
          path: 'orders',
          name: 'orders',
          component: OrdersView,
          meta: { title: 'Pedidos' },
        },
        {
          path: 'sales-history',
          name: 'sales-history',
          component: SalesHistoryView,
          meta: { title: 'Historial de ventas', roles: ['admin', 'cashier'] },
        },
        {
          path: 'sync',
          name: 'sync',
          component: SyncView,
          meta: { title: 'Sincronización' },
        },
        {
          path: 'users',
          name: 'users',
          component: UsersView,
          meta: { title: 'Usuarios', roles: ['admin'] },
        },
        {
          path: 'sessions',
          name: 'sessions',
          component: SessionsView,
          meta: { title: 'Mis sesiones' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.public) {
    // Si ya hay sesión, el login no tiene sentido: se va al inicio
    if (to.name === 'login' && (await auth.ensureSession())) {
      return { path: '/' }
    }
    return true
  }

  if (!(await auth.ensureSession())) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.roles && !auth.hasRole(...to.meta.roles)) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
