<!-- src/components/FieldsView.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameEngine } from '../composables/useGameEngine'
import type { Field, Crop } from '../types'

const { 
  fields, crops, addField, removeField, 
  updateFieldState, updateFieldCrop, updateFieldRotationCrop, toggleFieldGreenManure 
} = useGameEngine()

const searchKeyword = ref('')
const newFieldName = ref('')
const isMergeModalOpen = ref(false)
const openCropDropdownId = ref<string | null>(null)
const openRotationDropdownId = ref<string | null>(null)
const openStateDropdownId = ref<string | null>(null)
const cropSearchQueries = ref<Record<string, string>>({})
const confirmDeleteId = ref<string | null>(null)

// 7 種農田狀態字典
const FIELD_STATES: Array<{ key: Field['state']; label: string; class: string }> = [
  { key: 'idle', label: '休耕中', class: 'bg-slate-100 text-slate-600 border border-slate-200' },
  { key: 'cover_crop_seeded', label: '綠肥生長中', class: 'bg-lime-100 text-lime-800 border border-lime-300' },
  { key: 'idle_fertilized', label: '休耕 (已帶綠肥底肥)', class: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  { key: 'seeded', label: '剛播種 (待施肥 1)', class: 'bg-sky-100 text-sky-800 border border-sky-300' },
  { key: 'fertilized_1', label: '已施肥 1 次 (生長中)', class: 'bg-blue-100 text-blue-800 border border-blue-300' },
  { key: 'fertilized_2', label: '滿肥 (等收割)', class: 'bg-indigo-100 text-indigo-800 border border-indigo-300' },
  { key: 'ready_to_harvest', label: '成熟待收割', class: 'bg-amber-100 text-amber-800 border border-amber-300' }
]

const getStateBadge = (state: Field['state']) => {
  return FIELD_STATES.find(s => s.key === state) || { label: state, class: 'bg-slate-100 text-slate-600' }
}

const formatMergedName = (fieldList: Field[]) => {
  if (fieldList.length === 1) return fieldList[0].name
  const names = fieldList.map(f => f.name)
  if (names.every(n => n.endsWith('號田'))) {
    return `${names.map(n => n.replace(/號田$/, '')).join('+')}號田`
  }
  if (names.every(n => n.endsWith('田'))) {
    return `${names.map(n => n.replace(/田$/, '')).join('+')}田`
  }
  return names.join(' + ')
}

export interface RotationOption {
  crop: Crop;
  rotationType: 'single_year' | 'multi_year';
  typeBadge: string;
  badgeClass: string;
  detailText: string;
}

// 修正版：嚴謹的雙向閉環輪作判定演算法
const getAvailableRotationOptions = (mainCropId: string | null): RotationOption[] => {
  if (!mainCropId) return []
  const mainCrop = crops.value.find(c => c.id === mainCropId)
  if (!mainCrop || mainCrop.isRecurring || mainCrop.id === 'oilseed_radish') return []

  const mainSowMonths = mainCrop.sowingMonths || []
  const mainHarvestMonths = mainCrop.harvestMonths || []
  const mainGrowth = mainCrop.growthMonths || 4
  if (mainSowMonths.length === 0 || mainHarvestMonths.length === 0) return []

  const options: RotationOption[] = []

  crops.value.forEach(cand => {
    if (cand.id === mainCrop.id || cand.isRecurring || cand.id === 'oilseed_radish') return

    const candSowMonths = cand.sowingMonths || []
    const candHarvestMonths = cand.harvestMonths || []
    const candGrowth = cand.growthMonths || 4
    if (candSowMonths.length === 0 || candHarvestMonths.length === 0) return

    let bestMatch: { type: 'single_year' | 'multi_year'; detailText: string; totalMonths: number } | null = null

    // 依序測試主作物的每個合法播種月 (去程判定)
    for (const sA of mainSowMonths) {
      const hA = ((sA - 1 + mainGrowth) % 12) + 1
      if (!mainHarvestMonths.includes(hA)) continue

      // 1. 去程接續：候選作物播種月必須在 mainCrop 收割月當月或次月
      const possibleSowB = [hA, (hA % 12) + 1].filter(m => candSowMonths.includes(m))

      for (const sB of possibleSowB) {
        const hB = ((sB - 1 + candGrowth) % 12) + 1
        if (!candHarvestMonths.includes(hB)) continue

        const gapAB = (sB - hA + 12) % 12 // 0 or 1

        // 2. 回程閉環判定：找出距離 hB 最近的主作物播種月 (next_sA)
        let minGapBA = 12
        let bestNextSA = mainSowMonths[0]

        for (const nextSA of mainSowMonths) {
          const gap = (nextSA - hB + 12) % 12
          if (gap < minGapBA) {
            minGapBA = gap
            bestNextSA = nextSA
          }
        }

        const totalMonths = mainGrowth + gapAB + candGrowth + minGapBA

        // 如果找到更短的循環路徑，則更新最佳解
        if (!bestMatch || totalMonths < bestMatch.totalMonths) {
          if (totalMonths <= 12) {
            bestMatch = {
              type: 'single_year',
              totalMonths,
              detailText: `約 ${totalMonths} 個月完成雙收，${hB} 月收割後無縫接回 ${bestNextSA} 月播種`
            }
          } else if (totalMonths <= 24) {
            bestMatch = {
              type: 'multi_year',
              totalMonths,
              detailText: `2 年期循環 (總計 ${totalMonths} 個月)，${hB} 月收割後等待接回 ${bestNextSA} 月播種`
            }
          }
        }
      }
    }

    if (bestMatch) {
      options.push({
        crop: cand,
        rotationType: bestMatch.type,
        typeBadge: bestMatch.type === 'single_year' ? '⚡ 單年雙收' : '🔄 跨年輪作',
        badgeClass: bestMatch.type === 'single_year' 
          ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
          : 'bg-indigo-100 text-indigo-800 border-indigo-300',
        detailText: bestMatch.detailText
      })
    }
  })

  // 排序：單年雙收優先，其餘依名稱排序
  return options.sort((a, b) => {
    if (a.rotationType !== b.rotationType) return a.rotationType === 'single_year' ? -1 : 1
    return a.crop.name.localeCompare(b.crop.name, 'zh-TW')
  })
}

const getSelectedRotationMeta = (mainCropId: string | null, rotCropId: string | null | undefined): RotationOption | null => {
  if (!mainCropId || !rotCropId) return null
  const opts = getAvailableRotationOptions(mainCropId)
  return opts.find(o => o.crop.id === rotCropId) || null
}

interface FieldCardGroup {
  cardId: string;
  displayName: string;
  primaryField: Field;
  allFields: Field[];
  isMerged: boolean;
}

const displayFieldCards = computed<FieldCardGroup[]>(() => {
  const groups: Record<string, Field[]> = {}
  const ungrouped: Field[] = []

  fields.value.forEach(f => {
    if (f.mergedGroupId) {
      if (!groups[f.mergedGroupId]) groups[f.mergedGroupId] = []
      groups[f.mergedGroupId].push(f)
    } else {
      ungrouped.push(f)
    }
  })

  const result: FieldCardGroup[] = []
  Object.entries(groups).forEach(([groupId, list]) => {
    result.push({
      cardId: `group_${groupId}`,
      displayName: formatMergedName(list),
      primaryField: list[0],
      allFields: list,
      isMerged: true
    })
  })

  ungrouped.forEach(f => {
    result.push({
      cardId: f.id,
      displayName: f.name,
      primaryField: f,
      allFields: [f],
      isMerged: false
    })
  })

  if (!searchKeyword.value.trim()) return result
  const q = searchKeyword.value.trim().toLowerCase()
  return result.filter(card => 
    card.displayName.toLowerCase().includes(q) ||
    card.allFields.some(f => f.name.toLowerCase().includes(q))
  )
})

const getCropName = (cropId: string | null | undefined) => {
  if (!cropId) return '未選擇'
  return crops.value.find(c => c.id === cropId)?.name || '未知作物'
}

const handleAddField = () => {
  if (newFieldName.value.trim()) {
    addField(newFieldName.value.trim())
    newFieldName.value = ''
  }
}

const handleDeleteCard = (card: FieldCardGroup) => {
  if (confirmDeleteId.value === card.cardId) {
    card.allFields.forEach(f => removeField(f.id))
    confirmDeleteId.value = null
  } else {
    confirmDeleteId.value = card.cardId
    setTimeout(() => {
      if (confirmDeleteId.value === card.cardId) confirmDeleteId.value = null
    }, 3000)
  }
}

const toggleMergeField = (targetFieldId: string, baseFieldId: string) => {
  const base = fields.value.find(f => f.id === baseFieldId)
  const target = fields.value.find(f => f.id === targetFieldId)
  if (!base || !target) return

  if (!base.mergedGroupId) {
    base.mergedGroupId = `group_${Date.now()}`
  }

  if (target.mergedGroupId === base.mergedGroupId) {
    target.mergedGroupId = null
    const remaining = fields.value.filter(f => f.mergedGroupId === base.mergedGroupId)
    if (remaining.length <= 1) {
      remaining.forEach(f => { f.mergedGroupId = null })
    }
  } else {
    target.mergedGroupId = base.mergedGroupId
    target.currentCropId = base.currentCropId
    target.rotationCropId = base.rotationCropId
    target.state = base.state
  }
}
</script>

<template>
  <div class="space-y-4 animate-fade-in pb-12">
    <!-- 頂部工具列 -->
    <div class="space-y-2.5">
      <!-- 第 1 列：搜尋列 + 合併設定按鈕 -->
      <div class="flex gap-2 items-center">
        <div class="relative flex-1">
          <span class="absolute left-3.5 top-2.5 text-slate-400">🔍</span>
          <input 
            v-model="searchKeyword" 
            placeholder="搜尋農田名稱..." 
            class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 outline-none shadow-sm"
          />
        </div>
        <button 
          @click="isMergeModalOpen = true" 
          class="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl font-bold active:scale-95 transition-all shadow-sm text-sm whitespace-nowrap flex items-center gap-1.5 flex-shrink-0"
        >
          <span>🔗</span>
          <span>合併設定</span>
        </button>
      </div>

      <!-- 第 2 列：新農田輸入框 + 新增按鈕 -->
      <div class="flex gap-2">
        <input 
          v-model="newFieldName" 
          placeholder="新農田名稱 (例: 2號田)..." 
          class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
          @keyup.enter="handleAddField"
        />
        <button 
          @click="handleAddField" 
          class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold active:scale-95 transition-all shadow-sm text-sm whitespace-nowrap flex-shrink-0"
        >
          新增
        </button>
      </div>
    </div>

    <!-- 農田卡片列表 -->
    <div class="space-y-3">
      <div 
        v-for="card in displayFieldCards" 
        :key="card.cardId" 
        class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm transition-all"
      >
        <!-- 卡片頂部：名稱、合併標籤、刪除按鈕 -->
        <div class="flex justify-between items-start mb-3">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-black text-slate-800 text-lg tracking-wide">{{ card.displayName }}</span>
            <span v-if="card.isMerged" class="px-2 py-0.5 rounded-md text-xs font-black bg-indigo-100 text-indigo-700">
              合併田 ({{ card.allFields.length }}塊)
            </span>
          </div>
          <button 
            @click="handleDeleteCard(card)" 
            :class="['px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95', confirmDeleteId === card.cardId ? 'bg-red-500 text-white' : 'text-slate-400 bg-slate-100 hover:bg-slate-200']"
          >
            {{ confirmDeleteId === card.cardId ? '確認刪除?' : '✕' }}
          </button>
        </div>

        <!-- 狀態標籤與綠肥開關 -->
        <div class="mb-3 relative">
          <div class="flex items-center justify-between">
            <div 
              @click="openStateDropdownId = openStateDropdownId === card.cardId ? null : card.cardId"
              :class="['px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 active:scale-95 transition-all shadow-xs', getStateBadge(card.primaryField.state).class]"
            >
              <span>{{ getStateBadge(card.primaryField.state).label }}</span>
              <span class="opacity-50 text-[10px]">▼</span>
            </div>

            <button 
              @click="toggleFieldGreenManure(card.primaryField.id)"
              :class="['px-2.5 py-1 rounded-lg text-xs font-bold transition-all border active:scale-95', card.primaryField.enableGreenManure ? 'bg-lime-50 text-lime-800 border-lime-300' : 'bg-slate-50 text-slate-400 border-slate-200']"
            >
              {{ card.primaryField.enableGreenManure ? '🌱 綠肥提醒：開啟' : '🌱 綠肥提醒：關閉' }}
            </button>
          </div>

          <!-- 手動切換狀態選單 -->
          <div 
            v-if="openStateDropdownId === card.cardId" 
            class="absolute left-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 w-60 space-y-1 animate-fade-in"
          >
            <div class="text-[11px] font-bold text-slate-400 px-2 py-1">手動校正農田狀態：</div>
            <button 
              v-for="st in FIELD_STATES" 
              :key="st.key"
              @click="updateFieldState(card.primaryField.id, st.key); openStateDropdownId = null"
              :class="['w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors', card.primaryField.state === st.key ? 'bg-slate-100 text-slate-800 font-black' : 'hover:bg-slate-50 text-slate-600']"
            >
              <span>{{ st.label }}</span>
              <span v-if="card.primaryField.state === st.key" class="text-emerald-600 text-xs">✓</span>
            </button>
          </div>
        </div>

        <!-- 作物選擇區塊 -->
        <div :class="['grid gap-2', getAvailableRotationOptions(card.primaryField.currentCropId).length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1']">
          
          <!-- 1. 主耕種作物 -->
          <div class="relative">
            <label class="block text-[11px] font-bold text-slate-400 mb-1">主耕種作物</label>
            <div 
              @click="openCropDropdownId = openCropDropdownId === card.cardId ? null : card.cardId; openRotationDropdownId = null"
              class="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-slate-700 cursor-pointer flex justify-between items-center transition-colors"
            >
              <span class="truncate">🌾 {{ getCropName(card.primaryField.currentCropId) }}</span>
              <span class="text-slate-400 text-xs transition-transform" :class="{'rotate-180': openCropDropdownId === card.cardId}">▼</span>
            </div>

            <!-- 主作物彈出選單 -->
            <div 
              v-if="openCropDropdownId === card.cardId" 
              class="absolute bottom-full mb-1 z-50 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-fade-in"
            >
              <div class="p-2 border-b border-slate-100">
                <input 
                  type="text" 
                  v-model="cropSearchQueries[card.cardId]" 
                  placeholder="搜尋主作物..." 
                  class="w-full bg-slate-100 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div class="max-h-52 overflow-y-auto pb-1">
                <div 
                  class="px-4 py-2.5 text-sm cursor-pointer text-slate-500 hover:bg-slate-50 flex items-center justify-between"
                  @click.stop="updateFieldCrop(card.primaryField.id, null); openCropDropdownId = null"
                >
                  <span>休耕中 (未選作物)</span>
                  <span v-if="!card.primaryField.currentCropId" class="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">目前</span>
                </div>
                <div 
                  v-for="crop in crops.filter(c => !cropSearchQueries[card.cardId] || c.name.includes(cropSearchQueries[card.cardId]))" 
                  :key="crop.id" 
                  @click.stop="updateFieldCrop(card.primaryField.id, crop.id); openCropDropdownId = null"
                  class="px-4 py-2.5 text-sm cursor-pointer font-bold text-slate-700 hover:bg-emerald-50 border-t border-slate-50 flex items-center justify-between"
                >
                  <span>{{ crop.name }}</span>
                  <span v-if="card.primaryField.currentCropId === crop.id" class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">選取中</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. 閉環輪作選單 -->
          <div v-if="getAvailableRotationOptions(card.primaryField.currentCropId).length > 0" class="relative animate-fade-in">
            <label class="flex items-center justify-between text-[11px] font-bold text-purple-700 mb-1">
              <span>🔄 接續輪作作物</span>
              <span 
                v-if="card.primaryField.rotationCropId && getSelectedRotationMeta(card.primaryField.currentCropId, card.primaryField.rotationCropId)" 
                :class="['text-[10px] px-1.5 py-0.5 rounded font-bold border', getSelectedRotationMeta(card.primaryField.currentCropId, card.primaryField.rotationCropId)?.badgeClass]"
              >
                {{ getSelectedRotationMeta(card.primaryField.currentCropId, card.primaryField.rotationCropId)?.typeBadge }}
              </span>
            </label>
            <div 
              @click="openRotationDropdownId = openRotationDropdownId === card.cardId ? null : card.cardId; openCropDropdownId = null"
              :class="['border rounded-xl p-2.5 text-sm font-bold cursor-pointer flex justify-between items-center transition-colors', card.primaryField.rotationCropId ? 'bg-purple-50/60 border-purple-200 text-purple-900' : 'bg-slate-50 border-slate-200 text-slate-500']"
            >
              <span class="truncate">{{ card.primaryField.rotationCropId ? '🔄 ' + getCropName(card.primaryField.rotationCropId) : '無 (不輪作)' }}</span>
              <span class="text-slate-400 text-xs transition-transform" :class="{'rotate-180': openRotationDropdownId === card.cardId}">▼</span>
            </div>

            <!-- 輪作候選作物選單 -->
            <div 
              v-if="openRotationDropdownId === card.cardId" 
              class="absolute bottom-full mb-1 z-50 w-full sm:w-[320px] bg-white border border-purple-200 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
            >
              <div class="p-2.5 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                <span class="text-[11px] font-bold text-purple-800">可閉環接續的輪作作物：</span>
                <span class="text-[10px] text-purple-600 font-semibold">雙向驗證合格</span>
              </div>
              <div class="max-h-60 overflow-y-auto divide-y divide-slate-100">
                <div 
                  class="px-4 py-3 text-sm cursor-pointer text-slate-500 hover:bg-slate-50 flex items-center justify-between"
                  @click.stop="updateFieldRotationCrop(card.primaryField.id, null); openRotationDropdownId = null"
                >
                  <span>無 (不輪作)</span>
                  <span v-if="!card.primaryField.rotationCropId" class="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">目前</span>
                </div>
                
                <div 
                  v-for="rotOpt in getAvailableRotationOptions(card.primaryField.currentCropId)" 
                  :key="'rot_'+rotOpt.crop.id" 
                  @click.stop="updateFieldRotationCrop(card.primaryField.id, rotOpt.crop.id); openRotationDropdownId = null"
                  class="px-4 py-3 cursor-pointer hover:bg-purple-50/70 transition-colors flex items-start justify-between gap-2"
                >
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-slate-800 text-sm">{{ rotOpt.crop.name }}</span>
                      <span :class="['text-[10px] px-1.5 py-0.5 rounded font-bold border', rotOpt.badgeClass]">
                        {{ rotOpt.typeBadge }}
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-500 font-medium leading-tight">
                      {{ rotOpt.detailText }}
                    </p>
                  </div>
                  <span v-if="card.primaryField.rotationCropId === rotOpt.crop.id" class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold flex-shrink-0 mt-0.5">
                    選取中
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 歷程狀態小字 -->
        <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-4 text-xs font-semibold text-slate-400 flex-wrap">
          <span v-if="card.primaryField.plantedCropId" class="text-emerald-700 font-bold">
            🌱 目前生長：{{ getCropName(card.primaryField.plantedCropId) }} ({{ card.primaryField.plantedMonth }}月播種)
          </span>
          <span v-else-if="card.primaryField.state === 'cover_crop_seeded' && card.primaryField.plantedMonth" class="text-lime-700 font-bold">
            🌱 綠肥：{{ card.primaryField.plantedMonth }} 月播種中
          </span>
          <span v-else-if="card.primaryField.state === 'idle_fertilized' && card.primaryField.lastFertilizedMonth" class="text-emerald-700 font-bold">
            🚜 綠肥：{{ card.primaryField.lastFertilizedMonth }} 月已翻耕
          </span>
          <span v-else-if="card.primaryField.plantedMonth">
            🌱 播種於 {{ card.primaryField.plantedMonth }} 月
          </span>

          <span v-if="!['cover_crop_seeded', 'idle_fertilized'].includes(card.primaryField.state) && card.primaryField.lastFertilizedMonth">
            💧 最近施肥 {{ card.primaryField.lastFertilizedMonth }} 月
          </span>
          <span v-if="card.primaryField.harvestedMonth">
            🌾 最近收割 {{ card.primaryField.harvestedMonth }} 月
          </span>
        </div>
      </div>
    </div>

    <!-- 合併農田獨立彈窗 -->
    <div v-if="isMergeModalOpen" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
        <div class="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-xl font-extrabold text-slate-800">🔗 合併農田設定</h3>
            <p class="text-xs text-slate-500 mt-0.5">勾選連動後，排程與更換作物將自動同步</p>
          </div>
          <button @click="isMergeModalOpen = false" class="p-2 rounded-full text-slate-400 hover:bg-slate-100 font-bold">✕</button>
        </div>

        <div class="space-y-4">
          <div v-for="baseField in fields" :key="'merge_base_'+baseField.id" class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <div class="flex justify-between items-center mb-2">
              <span class="font-bold text-slate-700 text-sm">以【{{ baseField.name }}】為主組隊：</span>
              <span v-if="baseField.mergedGroupId" class="text-[11px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">已合併</span>
            </div>
            <div class="flex flex-wrap gap-2 pt-1">
              <label 
                v-for="other in fields.filter(f => f.id !== baseField.id)" 
                :key="'opt_'+other.id" 
                class="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer text-xs font-bold active:scale-95 transition-all"
              >
                <input 
                  type="checkbox" 
                  :checked="other.mergedGroupId === baseField.mergedGroupId && baseField.mergedGroupId !== null" 
                  @change="toggleMergeField(other.id, baseField.id)" 
                  class="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span class="text-slate-600">{{ other.name }}</span>
              </label>
            </div>
          </div>
        </div>

        <button @click="isMergeModalOpen = false" class="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl active:scale-95 transition-all text-sm shadow-md">
          完成設定
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>