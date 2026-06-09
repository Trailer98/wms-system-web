<template>
  <div class="main-layout">
    <header class="layout-header">
      <div class="logo">WMS System</div>
      <nav class="top-nav">
        <router-link to="/">首页</router-link>
        <router-link to="/operation-logs">日志查询</router-link>
        <router-link to="/settings">设置</router-link>
      </nav>
    </header>

    <div class="layout-body">
      <aside class="layout-sidebar">
        <ul>
          <li><router-link to="/">仪表盘</router-link></li>
          <li><router-link to="/operation-logs">日志查询</router-link></li>
          <li><router-link to="/settings">系统设置</router-link></li>
        </ul>
      </aside>

      <main class="layout-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
// 这是一个简单的布局组件，支持插槽内容
</script>

<style scoped>
.main-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f4f6fb;
}

.layout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 64px;
  background: #334155;
  color: #fff;
}

.logo {
  font-size: 1.1rem;
  font-weight: 700;
}

.top-nav a {
  color: #cbd5e1;
  margin-left: 20px;
  text-decoration: none;
}

.top-nav a.router-link-exact-active {
  color: #fff;
  font-weight: 600;
}

.top-nav a:hover {
  color: #fff;
}

.layout-body {
  display: flex;
  flex: 1;
}

.layout-sidebar {
  width: 220px;
  padding: 24px 16px;
  background: #1e293b;
  color: #cbd5e1;
}

.layout-sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.layout-sidebar li {
  margin-bottom: 16px;
}

.layout-sidebar a {
  color: inherit;
  text-decoration: none;
}

.layout-sidebar a.router-link-exact-active {
  color: #fff;
  font-weight: 600;
}

.layout-sidebar a:hover {
  color: #fff;
}

.layout-content {
  flex: 1;
  padding: 24px;
  background: #eef2ff;
}
</style>
