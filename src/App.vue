<script setup lang="ts">
import { ref, onMounted } from 'vue';
import PlatGenerator from './components/PlatGenerator.vue';
import TaskConverter from './components/TaskConverter.vue';
import TicketEditor from './components/TicketEditor.vue';
import AboutPage from './components/AboutPage.vue';
import {
  FormOutlined,
  SwapOutlined,
  FileTextOutlined,
  InfoCircleOutlined
} from '@ant-design/icons-vue';
import hushImg from './assets/hushDataUrl';
import type { SymbolRule } from './utils/textUtils.ts';
import {
  getDefaultTaskSettings,
  loadTaskSettings,
  saveTaskSettings,
  type Task,
} from './utils/taskSettings.ts';

const defaultSettings = getDefaultTaskSettings();
const tasks = ref<Task[]>(defaultSettings.tasks);
const stateNames = ref<string[]>(defaultSettings.stateNames);
const symbolRules = ref<SymbolRule[]>(defaultSettings.symbolRules);
const currentMenu = ref<string[]>(['editor']);

onMounted(() => {
  const saved = loadTaskSettings();
  tasks.value = saved.tasks;
  stateNames.value = saved.stateNames;
  symbolRules.value = saved.symbolRules;
});

const handleSaveTaskSettings = (newTasks: Task[], newStateNames: string[], newSymbolRules: SymbolRule[]) => {
  tasks.value = newTasks;
  stateNames.value = newStateNames;
  symbolRules.value = newSymbolRules;
  saveTaskSettings({
    tasks: newTasks,
    stateNames: newStateNames,
    symbolRules: newSymbolRules,
  });
};
</script>

<template>
  <div class="app-container">
    <div class="app-header">
      <div class="header-left">
        <img :src="hushImg" alt="logo" class="logo-img" />
        <span class="logo-text">操作票助手 <span class="version-tag">v0.4</span></span>
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
        <TicketEditor :tasks="tasks" :state-names="stateNames" :symbol-rules="symbolRules" />
      </div>
      <div v-show="currentMenu[0] === 'task'">
        <TaskConverter
          :tasks="tasks"
          :state-names="stateNames"
          :symbol-rules="symbolRules"
          :on-save-task-settings="handleSaveTaskSettings"
        />
      </div>
      <div v-show="currentMenu[0] === 'plat'">
        <PlatGenerator :symbol-rules="symbolRules" />
      </div>
      <div v-show="currentMenu[0] === 'about'">
        <AboutPage />
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
  display: flex;
  align-items: center;
}

.version-tag {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  background-color: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
  letter-spacing: 0;
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

@media (max-width: 900px) {
  .logo-text {
    display: none;
  }
}
</style>
