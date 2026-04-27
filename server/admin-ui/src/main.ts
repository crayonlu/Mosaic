import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { useThemeStore } from './stores/theme';
import './styles/global.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.mount('#app');

// Initialize theme (after mount so DOM is ready)
const theme = useThemeStore();
theme.init();
