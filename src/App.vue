<script setup>
import { ref, onMounted } from 'vue';
import defaultData from './templates/ticket_template.json';
import PlatGenerator from './components/PlatGenerator.vue';
import TaskConverter from './components/TaskConverter.vue';
import TicketEditor from './components/TicketEditor.vue';
import {
  FormOutlined,
  SwapOutlined,
  FileTextOutlined,
  InfoCircleOutlined
} from '@ant-design/icons-vue';
import hushImg from './assets/hushDataUrl';

const defaultTasks = defaultData.tasks;
const tasks = ref([...defaultTasks]);
const currentMenu = ref(['editor']);

onMounted(() => {
  const saved = localStorage.getItem('ticketTasks');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // 新格式: { tasks: [], stateNames: [] }；兼容旧格式（数组）
      if (Array.isArray(parsed)) { tasks.value = parsed; }
      else if (parsed.tasks) { tasks.value = parsed.tasks; }
    } catch (e) { console.error('Failed to parse tasks', e); }
  }
});

const handleSaveTasks = (newTasks, newStateNames) => {
  tasks.value = newTasks;
  localStorage.setItem('ticketTasks', JSON.stringify({ tasks: newTasks, stateNames: newStateNames }));
};
</script>

<template>
  <div class="app-container">
    <div class="app-header">
      <div class="header-left">
        <img :src="hushImg" alt="logo" class="logo-img" />
        <span class="logo-text">操作票助手</span>
      </div>
      <a-menu class="header-menu" v-model:selectedKeys="currentMenu" mode="horizontal">
        <a-menu-item key="editor">
          <template #icon><FormOutlined /></template>
          操作票编辑
        </a-menu-item>
        <a-menu-item key="task">
          <template #icon><SwapOutlined /></template>
          步骤转换
        </a-menu-item>
        <a-menu-item key="plat">
          <template #icon><FileTextOutlined /></template>
          压板文本
        </a-menu-item>
        <a-menu-item key="about">
          <template #icon><InfoCircleOutlined /></template>
          关于
        </a-menu-item>
      </a-menu>
    </div>

    <!-- 主体内容 -->
    <div class="main-content">
      <div v-show="currentMenu[0] === 'editor'">
        <TicketEditor :tasks="tasks" />
      </div>
      <div v-show="currentMenu[0] === 'task'">
        <TaskConverter :tasks="tasks" :on-save-tasks="handleSaveTasks" />
      </div>
      <div v-show="currentMenu[0] === 'plat'">
        <PlatGenerator />
      </div>
      <div v-show="currentMenu[0] === 'about'" class="about-page">
        <div class="author-card">
          <img class="author-avatar" :src="hushImg" alt="HUSH" />
          <div class="author-info">
            <div class="author-title">
              <span class="author-name">HUSH</span>
              <span class="author-split"></span>
              <span class="author-company">徐州公司</span>
              <span class="author-dept">500kV变电运检中心</span>
            </div>
            <p class="author-bio">Code is cheap, show me the talk!</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
body {
  margin: 0;
  background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 50%, #e8f5e9 100%);
  min-height: 100vh;
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  height: 64px;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 40px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
  margin-right: 64px;
}

.logo-img {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  object-fit: cover;
}

.logo-text {
  font-size: 20px;
  font-weight: 600;
  margin-left: 12px;
  color: #000000;
  letter-spacing: 1px;
}

.header-menu {
  flex: 1;
  border-bottom: none !important;
  line-height: 62px;
}

.header-menu .ant-menu-item {
  font-size: 16px;
}

.main-content {
  flex: 1;
  padding: 24px;
  box-sizing: border-box;
}

.about-page {
  display: flex;
  justify-content: center;
}

.author-card {
  display: flex;
  align-items: center;
  width: min(100%, 400px);
  margin-bottom: 15px;
  padding: 15px 15px;
  border-radius: 12px;
  background-color: var(--panel-bg-light, #ffffff);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color-light, #f0f0f0);
}

.author-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 15px;
  border: 2px solid #fff;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.author-info {
  display: flex;
  flex-direction: column;
}

.author-title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.author-name {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #222;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.author-split {
  display: inline-block;
  width: 8px;
}

.author-company {
  font-size: 13px;
  font-weight: 500;
  color: #555;
  white-space: nowrap;
}

.author-dept {
  font-size: 13px;
  color: #888;
  white-space: nowrap;
}

.author-split-vertical {
  display: inline-block;
  height: 12px;
  width: 1px;
  background-color: #ccc;
  margin: 0 8px;
  transform: translateY(1px);
}

.author-bio {
  margin: 0;
  font-size: 13px;
  color: #888;
  font-style: italic;
  font-family: Georgia, 'Times New Roman', Times, serif;
  line-height: 1.4;
}

@media (max-width: 900px) {
  .logo-text {
    display: none;
  }
}
</style>
