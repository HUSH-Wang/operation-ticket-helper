import { createApp } from 'vue'
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import './style.css'
import App from './App.vue'
import { appConfig } from './config/appConfig.ts';

document.title = appConfig.title;

const app = createApp(App)
app.use(Antd)
app.mount('#app')
