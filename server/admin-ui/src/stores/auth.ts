import { defineStore } from 'pinia';
import { api, clearToken, getToken, setToken, type LoginResponse, type UserResponse } from '../api';

interface User {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    initialized: false,
  }),
  getters: {
    isLoggedIn: (state) => !!getToken() && !!state.user,
  },
  actions: {
    async login(username: string, password: string) {
      const res = (await api('/auth/login', {
        method: 'POST',
        body: { username, password },
      })) as LoginResponse;
      setToken(res.accessToken, res.refreshToken);
      this.user = res.user;
    },
    async fetchMe() {
      try {
        const res = (await api('/auth/me')) as UserResponse;
        this.user = res;
      } catch {
        clearToken();
        this.user = null;
      }
    },
    async init() {
      if (getToken()) {
        await this.fetchMe();
      }
      this.initialized = true;
    },
    logout() {
      clearToken();
      this.user = null;
    },
  },
});
