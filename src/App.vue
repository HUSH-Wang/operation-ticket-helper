<script setup>
import { ref, onMounted } from 'vue';
import defaultData from './templates/ticket_template.json';
import PlatGenerator from './components/PlatGenerator.vue';
import TaskConverter from './components/TaskConverter.vue';
import TicketEditor from './components/TicketEditor.vue';

const defaultTasks = defaultData.tasks;
const tasks = ref([...defaultTasks]);

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
    <a-tabs class="main-tabs" centered size="large">
      <a-tab-pane key="editor" tab="文本编辑">
        <TicketEditor :tasks="tasks" />
      </a-tab-pane>
      <a-tab-pane key="task" tab="任务状态转换">
        <TaskConverter :tasks="tasks" :on-save-tasks="handleSaveTasks" />
      </a-tab-pane>
      <a-tab-pane key="plat" tab="压板生成">
        <PlatGenerator />
      </a-tab-pane>
    </a-tabs>
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
  padding: 24px;
  box-sizing: border-box;
}

.main-tabs .ant-tabs-nav {
  margin-bottom: 16px;
}

.main-tabs .ant-tabs-tab {
  font-size: 16px;
  font-weight: 500;
  padding: 8px 24px;
}
</style>
