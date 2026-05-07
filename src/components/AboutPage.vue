<script setup lang="ts">
import { 
  FormOutlined,
  SwapOutlined,
  FileTextOutlined
} from '@ant-design/icons-vue';
import hushImg from '../assets/hushDataUrl';
</script>

<template>
  <div class="about-page-wrap">
    <!-- 1. 作者信息 -->
    <div class="author-card">
      <img class="author-avatar" :src="hushImg" alt="HUSH" />
      <div class="author-info">
        <div class="author-title">
          <span class="author-name">HUSH</span>
          <span class="author-split"></span>
          <span class="author-company">徐州公司</span>
          <span class="author-split-vertical"></span>
          <span class="author-dept">500kV变电运检中心</span>
        </div>
        <p class="author-bio">Code is cheap, show me the talk!</p>
      </div>
    </div>

    <!-- 2. 网页功能说明 -->
    <a-card class="info-card" title="网页功能说明" :bordered="false">
      <div class="feature-section">
        <h3 class="feature-title"><FormOutlined class="feature-icon" /> 操作票编辑</h3>
        <ul class="feature-list">
          <li><strong>沉浸式编辑</strong>：在宽大的文本框内自由输入或粘贴全部操作步骤，网页自带记忆功能，每10秒自动保存，刷新不丢失。</li>
          <li><strong>快捷状态转换</strong>：选中需要修改的行（或将光标停留在此行），点击上方按钮、点击右键菜单、或使用快捷键 <code>Alt + 1/2/3/4</code>，即可将此行语句就地转化为其他状态格式。</li>
          <li><strong>一键清空数值</strong>：提供“清空电压电流”功能，快速将括号中的实测电压、电流数值替换为标准的三空格，并智能统一中英文括号及标点符号。</li>
          <li><strong>撤销与重做</strong>：支持完备的历史记录撤回（快捷栏按钮或右键），防止误操作。</li>
          <li><strong>阅读体验优化</strong>：可随时调大或调小编辑器字号以适配阅读。</li>
        </ul>
      </div>

      <div class="feature-section">
        <h3 class="feature-title"><SwapOutlined class="feature-icon" /> 步骤转换</h3>
        <ul class="feature-list">
          <li><strong>智能识别</strong>：对于收集来的大段杂乱文本，一键粘贴，系统能跨越换行和空格隔阂，聪明地识别出这是刀闸、开关还是压板，且当前属于什么状态。</li>
          <li><strong>辅助数据过滤</strong>：新增“清空电压电流”快捷功能，在转换前就可快速将复杂测量数据过滤为标准空格填充位。</li>
          <li><strong>全自动转换</strong>：选中目标后系统一次性将识别出的所有语句统一整理输出，无法匹配的部分将以浅黄色高亮提示。</li>
          <li><strong>定制灵活</strong>：允许深度的自定义模板配置（点击右上角设置图标），支持导出 JSON 配置文件分享给同事跨设备使用。</li>
          <li><strong>符号兼容可配</strong>：步骤转换设置中可单独维护“规范输出”和“兼容识别符号”，用于统一处理中英文引号、括号、逗号等写法，输出始终以模板中的规范符号为准。</li>
        </ul>
      </div>

      <div class="feature-section">
        <h3 class="feature-title"><FileTextOutlined class="feature-icon" /> 压板文本</h3>
        <ul class="feature-list">
          <li><strong>批量生成</strong>：将长的压板名字一次性贴入右侧即可（无需手动加括号），左侧填屏名，选择目标动作后一秒钟即生成多条标准语句。</li>
          <li><strong>逆向提取（解析提取）</strong>：遇到已写好的压板步骤想修改动作？切换到解析模式，贴入步骤，一键提取出干干净净的纯压板名列表，用来重新生成其他动作。</li>
        </ul>
      </div>
    </a-card>

    <!-- 3. 更新日志 -->
    <a-card class="info-card" title="更新日志" :bordered="false" style="margin-top: 20px;">
      <a-timeline>
        <a-timeline-item color="green">
          <p class="log-version">
            <span>v0.4 (当前版本)</span>
            <span class="log-date">2026.05.07</span>
          </p>
          <ul class="log-list">
            <li>新增全局符号兼容规则：步骤转换、编辑器原位转换、压板解析三处统一支持按规则识别中英文引号、括号、逗号等符号。</li>
            <li>符号输出规范化：输入英文直引号或英文括号时，匹配成功后会自动按照主模板中的中文符号输出；模板中的 <code>/</code> 保持原样不参与转换。</li>
            <li>设置页增强：任务模板配置新增符号规则维护、导入导出与一键重置，并优化了模板与符号输入框的字体和紧凑布局，便于区分左右引号等细微符号。</li>
            <li>输入体验修复：解决设置页中输入中文引号、句号等符号时“光标移动但字符未录入”的问题，改为保存时再统一解析配置。</li>
          </ul>
        </a-timeline-item>
        <a-timeline-item color="green">
          <p class="log-version">
            <span>v0.3</span>
            <span class="log-date">2026.05.06</span>
          </p>
          <ul class="log-list">
            <li>远方/就地规则更新：检查步骤采用“确在”新写法，同时继续兼容“确已切至”等旧写法，转换输出统一为最新模板。</li>
            <li>模板规则增强：步骤转换支持主模板与兼容模板的数组结构，便于后续持续扩展多种历史写法。</li>
            <li>新增规则重置：步骤转换和压板文本的设置框均支持一键恢复内置默认规则，保存后即可覆盖本地自定义配置。</li>
            <li>工程整理：补充 TypeScript 入口和类型定义，提升构建检查与后续维护体验。</li>
          </ul>
        </a-timeline-item>
        <a-timeline-item color="blue">
          <p class="log-version">
            <span>v0.2</span>
            <span class="log-date">2026.03.06</span>
          </p>
          <ul class="log-list">
            <li>上线全新「操作票编辑」界面：支持实时高亮修改结果、无限次撤销重做、以及完备的快捷键沉浸体验。</li>
            <li>增强正则兼容模式：深度优化模板解析引擎，支持模糊匹配全半角括号以及顿号与逗号；容忍单位和空格的不一致缺陷，提升转换成功率。</li>
            <li>新增实用数据处理：在编辑与转换页面添加“清空电压电流”功能，一键净化排版，智能修复中英夹杂的符号。</li>
            <li>UI改版：各组件面板布局统一美化，重构“关于”为使用说明聚合页。</li>
          </ul>
        </a-timeline-item>
        <a-timeline-item color="blue">
          <p class="log-version">
            <span>v0.1</span>
            <span class="log-date">2026.03.04</span>
          </p>
          <ul class="log-list">
            <li>基础大版本首发：具备「步骤转换」与「压板文本」生成两大核心功能。</li>
            <li>本地持久化存储和设备互导（兼容JSON格式导出与导入）。</li>
            <li>纯前端原生HTML离线打包部署。</li>
          </ul>
        </a-timeline-item>
      </a-timeline>
    </a-card>
  </div>
</template>

<style scoped>
.about-page-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  padding-bottom: 24px;
}

.author-card {
  display: flex;
  align-items: center;
  width: min(100%, 400px);
  margin-bottom: 24px;
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

.author-bio {
  margin: 0;
  font-size: 13px;
  color: #888;
  font-style: italic;
  font-family: Georgia, 'Times New Roman', Times, serif;
  line-height: 1.4;
}

.author-split-vertical {
  display: inline-block;
  height: 12px;
  width: 1px;
  background-color: #ccc;
  margin: 0 8px;
  transform: translateY(1px);
}

.info-card {
  width: 100%;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

:deep(.ant-card-head) {
  border-bottom: 1px dashed #e2e8f0;
}

:deep(.ant-card-head-title) {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.feature-section {
  margin-bottom: 20px;
}

.feature-section:last-child {
  margin-bottom: 0;
}

.feature-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
}

.feature-icon {
  margin-right: 8px;
  color: #6366f1;
}

.feature-list {
  padding-left: 24px;
  margin: 0;
  color: #475569;
  line-height: 1.6;
}

.feature-list li {
  margin-bottom: 6px;
}

.feature-list li strong {
  color: #334155;
}

.feature-list li code {
  background-color: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  color: #0ea5e9;
  font-family: Consolas, monospace;
}

.log-version {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 8px;
  font-size: 15px;
}

.log-date {
  font-weight: normal;
  font-size: 13px;
  color: #94a3b8;
}

.log-list {
  padding-left: 20px;
  margin: 0;
  color: #64748b;
  font-size: 14px;
}
.log-list li {
  margin-bottom: 4px;
}
</style>
