<!-- src/App.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameEngine } from './composables/useGameEngine'
import SettingsView from './components/SettingsView.vue' // 引入設定元件

// 宣告一個變數用來切換分頁
const activeTab = ref<'schedule' | 'settings'>('schedule')

// 1. 喚醒我們的遊戲引擎大腦，並把需要用到的變數與方法解構出來
const { 
  currentMonth, 
  tasks, 
  nextMonth, 
  prevMonth, 
  setMonth, 
  toggleTask 
} = useGameEngine()

// 2. 畫面邏輯：將任務分為「未完成」與「已完成」兩組
// 使用 computed (計算屬性) 的好處是，只要 tasks 陣列一有變動（例如你打勾了某個任務），
// 這兩個陣列就會自動重新分類，畫面也會跟著瞬間更新。
const pendingTasks = computed(() => tasks.value.filter(t => !t.isCompleted))
const completedTasks = computed(() => tasks.value.filter(t => t.isCompleted))

// 新增：任務專屬圖示
const getTaskIcon = (type: string) => {
  const icons: Record<string, string> = {
    sow: '🌱',
    harvest: '🌾',
    fertilize: '💧',
    sell: '💰',
    check_facility: '🏭'
  }
  return icons[type] || '📌'
}

// 3. 視覺輔助：根據任務種類，回傳不同的 Tailwind 邊框顏色
const getTaskColor = (type: string) => {
  const colors: Record<string, string> = {
    sow: 'border-green-500 text-green-700',
    harvest: 'border-yellow-500 text-yellow-700',
    fertilize: 'border-blue-500 text-blue-700',
    sell: 'border-purple-500 text-purple-700',
    check_facility: 'border-slate-400 text-slate-700'
  }
  return colors[type] || 'border-gray-200 text-gray-700'
}
</script>

<template>
  <!-- 最外層容器：設定淺灰背景、最小高度為整個螢幕，並在手機上保留內邊距 -->
  <div class="min-h-screen bg-slate-100 p-4 md:p-8 font-sans pb-36">
    
    <!-- 頂部標題與快捷月份選擇 -->
    <header class="max-w-md mx-auto mb-8">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight">FS25 農務助手</h1>
        <span class="px-4 py-1.5 bg-emerald-100 text-emerald-800 font-black rounded-full shadow-sm">
          {{ currentMonth }} 月
        </span>
      </div>
      
      <!-- 月份選擇器 (只有在看排程時才顯示) -->
      <div v-show="activeTab === 'schedule'" class="grid grid-cols-6 gap-1 bg-slate-200/60 p-1.5 rounded-2xl mb-6">
        <button v-for="m in 12" :key="m" @click="setMonth(m)" :class="['py-2 rounded-xl text-sm font-bold transition-all duration-300 ease-out', currentMonth === m ? 'bg-white text-emerald-600 shadow-sm scale-100 ring-1 ring-black/5' : 'text-slate-500 hover:bg-slate-300/50 hover:text-slate-800 scale-95 hover:scale-100']">
          {{ m }}
        </button>
      </div>

      <!-- 上下月切換與標題 (只有在看排程時才顯示) -->
      <div v-show="activeTab === 'schedule'" class="flex justify-between items-center px-1">
        <button @click="prevMonth" class="p-3 bg-white hover:bg-slate-50 rounded-full shadow-sm text-slate-500 transition-all hover:scale-110 active:scale-95"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg></button>
        <span class="text-2xl font-black text-slate-700 tracking-wide">{{ currentMonth }} 月排程</span>
        <button @click="nextMonth" class="p-3 bg-white hover:bg-slate-50 rounded-full shadow-sm text-slate-500 transition-all hover:scale-110 active:scale-95"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg></button>
      </div>
    </header>

    <!-- 任務清單區塊 -->
    <main class="max-w-md mx-auto space-y-4 mb-12">
      
      <div v-if="activeTab === 'schedule'">
      <!-- 如果這個月完全沒有任務的防呆提示 -->
      <div v-if="tasks.length === 0" class="text-center text-slate-500 py-8">
        這個月沒有任何排程，好好休息吧！
      </div>

      <!-- 區塊 A：未完成任務 -->
      <TransitionGroup name="list" tag="div" class="space-y-3 relative">
        <div 
          v-for="task in pendingTasks" 
          :key="task.id"
          @click="toggleTask(task.id)"
          :class="[
            'p-4 rounded-xl shadow-sm border-l-4 cursor-pointer transition-shadow hover:shadow-md flex items-center gap-4',
            getTaskColor(task.type)
          ]"
        >
          <div class="w-6 h-6 rounded-full border-2 border-current flex-shrink-0 opacity-60"></div>
          <span class="text-xl flex-shrink-0">{{ getTaskIcon(task.type) }}</span>
          <span class="font-bold tracking-wide">{{ task.title }}</span>
        </div>
      </TransitionGroup>

      <!-- 分隔線：只有當已完成和未完成都有東西時才顯示 -->
      <hr v-if="pendingTasks.length > 0 && completedTasks.length > 0" class="border-slate-300 my-4" />

      <!-- 區塊 B：已完成任務 (加上刪除線與透明度，並沉到最底下) -->
      <TransitionGroup name="list" tag="div" class="space-y-3 relative">
        <div 
          v-for="task in completedTasks" 
          :key="task.id"
          @click="toggleTask(task.id)"
          class="bg-slate-100 p-4 rounded-xl border-l-4 border-slate-300 cursor-pointer opacity-50 flex items-center gap-4 hover:opacity-75 transition-opacity"
        >
          <div class="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">
            ✓
          </div>
          <span class="text-xl flex-shrink-0 grayscale">{{ getTaskIcon(task.type) }}</span>
          <span class="font-bold text-slate-500 line-through">{{ task.title }}</span>
        </div>
      </TransitionGroup>
      </div>
      <!-- ================= 視圖 2：設定頁面 ================= -->
      <SettingsView v-if="activeTab === 'settings'" />
    </main>
    <!-- 固定在底部的 App 導覽列 -->
    <nav class="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 px-6 py-3 z-50">
      <div class="max-w-md mx-auto flex justify-around">
        <button 
          @click="activeTab = 'schedule'"
          :class="['flex flex-col items-center gap-1 transition-colors', activeTab === 'schedule' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600']"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span class="text-xs font-bold">當月排程</span>
        </button>
        <button 
          @click="activeTab = 'settings'"
          :class="['flex flex-col items-center gap-1 transition-colors', activeTab === 'settings' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600']"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          <span class="text-xs font-bold">農場設定</span>
        </button>
      </div>
    </nav>
  </div>
</template>

<style>
/* Vue Transition 動畫專用樣式 */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
/* 讓清單元素移動時更平滑 */
.list-move {
  transition: transform 0.4s ease;
}
</style>