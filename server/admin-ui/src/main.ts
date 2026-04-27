import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { ensureSolidMediaConfigured } from './lib/solidMedia';
import router from './router';
import { useThemeStore } from './stores/theme';
import './styles/global.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.mount('#app');

// Initialize solid-media for auth-protected image loading (e.g. bot avatars)
ensureSolidMediaConfigured();

// Initialize theme (after mount so DOM is ready)
const theme = useThemeStore();
theme.init();
