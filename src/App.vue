<!-- src/App.vue 的 <script setup> -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameEngine } from './composables/useGameEngine'
import FieldsView from './components/FieldsView.vue'
import SettingsView from './components/SettingsView.vue'

const activeTab = ref<'schedule' | 'fields' | 'settings'>('schedule')

const { 
  currentMonth, 
  tasks, 
  nextMonth, 
  prevMonth, 
  setMonth, 
  toggleTask,
  sowWithFertilizer,        // 引入帶肥播種快捷方法
  markPriceWindowCleared 
} = useGameEngine()

const pendingTasks = computed(() => tasks.value.filter(t => !t.isCompleted))
const completedTasks = computed(() => tasks.value.filter(t => t.isCompleted))

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
  <div class="min-h-screen bg-slate-100 p-4 md:p-8 font-sans pb-36">
    
    <!-- 頂部標題與月份選擇器 -->
    <header class="max-w-md mx-auto mb-6">
      <div class="flex justify-between items-center mb-5">
        <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight">FS25 農務助手</h1>
        <span class="px-4 py-1.5 bg-emerald-100 text-emerald-800 font-black rounded-full shadow-sm text-sm">
          {{ currentMonth }} 月
        </span>
      </div>
      
      <div v-show="activeTab !== 'settings'" class="grid grid-cols-6 gap-1 bg-slate-200/60 p-1.5 rounded-2xl mb-5">
        <button 
          v-for="m in 12" 
          :key="m" 
          @click="setMonth(m)" 
          :class="['py-2 rounded-xl text-sm font-bold transition-all duration-300 ease-out', currentMonth === m ? 'bg-white text-emerald-600 shadow-sm scale-100 ring-1 ring-black/5' : 'text-slate-500 hover:bg-slate-300/50 hover:text-slate-800 scale-95 hover:scale-100']"
        >
          {{ m }}
        </button>
      </div>

      <div v-show="activeTab === 'schedule'" class="flex justify-between items-center px-1 mb-2">
        <button @click="prevMonth" class="p-3 bg-white hover:bg-slate-50 rounded-full shadow-sm text-slate-500 transition-all hover:scale-110 active:scale-95">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <span class="text-2xl font-black text-slate-700 tracking-wide">{{ currentMonth }} 月排程</span>
        <button @click="nextMonth" class="p-3 bg-white hover:bg-slate-50 rounded-full shadow-sm text-slate-500 transition-all hover:scale-110 active:scale-95">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>
    </header>

    <!-- 主內容區塊 -->
    <main class="max-w-md mx-auto space-y-4 mb-12">
      
      <!-- 分頁 1：當月排程 -->
      <div v-if="activeTab === 'schedule'">
        <div v-if="tasks.length === 0" class="text-center text-slate-500 py-8 font-medium">
          這個月沒有任何排程，好好休息吧！
        </div>

        <!-- 未完成任務列表 -->
        <TransitionGroup name="list" tag="div" class="space-y-3 relative">
          <div 
            v-for="task in pendingTasks" 
            :key="task.id"
            @click="toggleTask(task.id)"
            :class="[
              'p-4 rounded-xl shadow-sm border-l-4 cursor-pointer transition-shadow hover:shadow-md flex items-center justify-between bg-white',
              getTaskColor(task.type)
            ]"
          >
            <div class="flex items-center gap-4">
              <div class="w-6 h-6 rounded-full border-2 border-current flex-shrink-0 opacity-60"></div>
              <span class="text-xl flex-shrink-0">{{ getTaskIcon(task.type) }}</span>
              <span class="font-bold tracking-wide">{{ task.title }}</span>
            </div>

            <!-- 右側功能按鈕區 -->
            <div class="flex items-center gap-2">
              <!-- 播種任務專屬：帶肥播種按鈕 (自動跳過第 1 次施肥) -->
              <button 
                v-if="task.type === 'sow'"
                @click.stop="sowWithFertilizer(task.id)"
                class="px-2.5 py-1.5 rounded-lg text-xs font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-800 active:scale-90 transition-all whitespace-nowrap shadow-xs flex items-center gap-1"
                title="使用附帶施肥箱的播種機作業，播種並自動完成第 1 次施肥"
              >
                <span>🌱+💧</span>
                <span>帶肥播種</span>
              </button>

              <!-- 高價提醒專屬：本期已出清按鈕 -->
              <button 
                v-if="task.type === 'sell'"
                @click.stop="markPriceWindowCleared(task.relatedEntityId)"
                class="px-2.5 py-1.5 rounded-lg text-xs font-black bg-purple-100 hover:bg-purple-200 text-purple-700 active:scale-90 transition-all whitespace-nowrap shadow-xs"
                title="出清後，同一個高價連續月份將不再重複提醒"
              >
                📦 本期已出清
              </button>
            </div>
          </div>
        </TransitionGroup>

        <!-- 分隔線 -->
        <hr v-if="pendingTasks.length > 0 && completedTasks.length > 0" class="border-slate-300 my-4" />

        <!-- 已完成任務 -->
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

      <!-- 分頁 2：農田概況 -->
      <FieldsView v-if="activeTab === 'fields'" />

      <!-- 分頁 3：農場設定 -->
      <SettingsView v-if="activeTab === 'settings'" />
    </main>

    <!-- 底部導覽列 -->
    <nav class="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 px-6 py-3 z-50">
      <div class="max-w-md mx-auto grid grid-cols-3">
        <button 
          @click="activeTab = 'schedule'"
          :class="['flex flex-col items-center gap-1 transition-colors', activeTab === 'schedule' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600']"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span class="text-xs font-bold">當月排程</span>
        </button>

        <button 
          @click="activeTab = 'fields'"
          :class="['flex flex-col items-center gap-1 transition-colors', activeTab === 'fields' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600']"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span class="text-xs font-bold">農田概況</span>
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
.list-move {
  transition: transform 0.4s ease;
}
</style>