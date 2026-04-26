import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '../api';

const router = createRouter({
  history: createWebHistory('/admin'),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('../layouts/AdminLayout.vue'),
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('../views/Dashboard.vue'),
        },
        {
          path: 'stats',
          name: 'Stats',
          component: () => import('../views/Stats.vue'),
        },
        {
          path: 'activity',
          name: 'Activity',
          component: () => import('../views/Activity.vue'),
        },
        {
          path: 'profile',
          name: 'Profile',
          component: () => import('../views/Profile.vue'),
        },
        {
          path: 'bots',
          name: 'Bots',
          component: () => import('../views/Bots.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('../layouts/AdminLayout.vue'),
      children: [
        {
          path: '',
          component: () => import('../views/NotFound.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to, _from, next) => {
  if (!to.meta.public && !getToken()) {
    next('/login');
  } else {
    next();
  }
});

export default router;
