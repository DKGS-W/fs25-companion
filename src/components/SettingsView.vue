<!-- src/components/SettingsView.vue -->
<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useGameEngine } from '../composables/useGameEngine'

const { 
  fields, facilities, crops, products, watchedPriceIds,
  addField, removeField, addFacility, removeFacility, addProduct, removeProduct, resetData, toggleWatchPrice 
} = useGameEngine()

const activeSubTab = ref<'fields' | 'facilities' | 'products' | 'crops'>('fields')

const newFieldName = ref('')
const newFacilityName = ref('')
const newProductName = ref('')
const newCropName = ref('')

const searchField = ref('')
const searchFacility = ref('')
const searchProduct = ref('')
const searchCrop = ref('')
const searchQueries = ref<Record<string, string>>({})

const highlightedId = ref<string | null>(null)
const editingFacilityId = ref<string | null>(null)
const mergingFieldId = ref<string | null>(null)
const openDropdowns = ref<Record<string, boolean>>({})
const expandedItems = ref<Record<string, boolean>>({}) 
const confirmDeleteId = ref<string | null>(null) 

const filteredAndSortedFields = computed(() => {
  let res = fields.value || []
  if (searchField.value) res = res.filter(f => f.name.includes(searchField.value))
  return res.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true }))
})

const filteredAndSortedFacilities = computed(() => {
  let res = facilities.value || []
  if (searchFacility.value) res = res.filter(f => f.name.includes(searchFacility.value))
  return res.slice().sort((a, b) => {
    if (a.isOwned !== b.isOwned) return a.isOwned ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-TW', { numeric: true })
  })
})

const filteredAndSortedProducts = computed(() => {
  let res = products.value || []
  if (searchProduct.value) res = res.filter(p => p.name.includes(searchProduct.value))
  return res.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true }))
})

const filteredAndSortedCrops = computed(() => {
  let res = crops.value || []
  if (searchCrop.value) res = res.filter(c => c.name.includes(searchCrop.value))
  return res.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true }))
})

const scrollToAndHighlight = async (id: string) => {
  await nextTick()
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightedId.value = id
    expandedItems.value[id] = true
    setTimeout(() => highlightedId.value = null, 2000)
  }
}

const handleAddField = async () => { if (newFieldName.value.trim()) { const id = addField(newFieldName.value.trim()); newFieldName.value = ''; searchField.value = ''; scrollToAndHighlight(id) } }
const handleAddFacility = async () => { if (newFacilityName.value.trim()) { const id = addFacility(newFacilityName.value.trim()); newFacilityName.value = ''; searchFacility.value = ''; scrollToAndHighlight(id) } }
const handleAddProduct = async () => { if (newProductName.value.trim()) { const id = addProduct(newProductName.value.trim(), false); newProductName.value = ''; searchProduct.value = ''; scrollToAndHighlight(id) } }
const handleAddCrop = async () => { if (newCropName.value.trim()) { const id = addProduct(newCropName.value.trim(), true); newCropName.value = ''; searchCrop.value = ''; scrollToAndHighlight(id) } }

const getProductName = (id: string) => products.value?.find(p => p.id === id)?.name || id
const getCropName = (id: string | null) => {
  if (id === null || id === undefined || id === '') return '休耕中 (無)'
  return crops.value?.find(c => c.id === id)?.name || '休耕中 (無)'
}
const safeDelete = (type: 'field'|'facility'|'product'|'crop', id: string) => {
  if (confirmDeleteId.value === id) {
    if (type === 'field') removeField(id)
    if (type === 'facility') removeFacility(id)
    if (type === 'product') removeProduct(id, false)
    if (type === 'crop') removeProduct(id, true)
    confirmDeleteId.value = null
  } else {
    confirmDeleteId.value = id
    setTimeout(() => { if (confirmDeleteId.value === id) confirmDeleteId.value = null }, 3000)
  }
}

const toggleMerge = (targetFieldId: string, currentFieldId: string) => {
  const currentField = fields.value?.find(f => f.id === currentFieldId)
  const targetField = fields.value?.find(f => f.id === targetFieldId)
  if (!currentField || !targetField) return
  if (!currentField.mergedGroupId) currentField.mergedGroupId = `group_${Date.now()}`
  targetField.mergedGroupId = targetField.mergedGroupId === currentField.mergedGroupId ? null : currentField.mergedGroupId
}

const toggleMonth = (arr: number[] | undefined, m: number) => {
  if (!arr) return
  const idx = arr.indexOf(m)
  if (idx > -1) arr.splice(idx, 1)
  else arr.push(m)
  arr.sort((a, b) => a - b)
}

const isWatched = (id: string) => (watchedPriceIds.value || []).includes(id)
</script>

<template>
  <div class="space-y-6 animate-fade-in pb-12">
    <!-- 次選單導覽 -->
    <div class="flex overflow-x-auto gap-2 pb-2 scrollbar-hide sticky top-0 bg-slate-50 z-40 py-2">
      <button v-for="(label, key) in { fields: '🚜 農田', facilities: '🏭 設施', products: '📦 產品', crops: '🌾 作物' }" :key="key" @click="activeSubTab = key as any" :class="['whitespace-nowrap px-4 py-2.5 rounded-full font-bold transition-all active:scale-95 text-sm', activeSubTab === key ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300']">
        {{ label }}
      </button>
    </div>

    <!-- 1. 農田管理 -->
    <section v-if="activeSubTab === 'fields'" class="space-y-4">
      <div class="flex gap-2">
        <input v-model="newFieldName" placeholder="新農田名稱..." class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-emerald-500 outline-none">
        <button @click="handleAddField" class="bg-emerald-500 text-white px-5 py-3 rounded-xl font-bold active:scale-95 transition-all shadow-sm">新增</button>
      </div>
      
      <div class="relative">
        <span class="absolute left-3 top-3.5 text-slate-400">🔍</span>
        <input v-model="searchField" placeholder="搜尋農田名稱..." class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-3 text-base focus:ring-2 focus:ring-slate-300 outline-none">
      </div>

      <div v-for="field in filteredAndSortedFields" :key="field.id" :id="field.id" :class="['bg-white p-4 rounded-2xl border transition-all duration-500', highlightedId === field.id ? 'border-amber-400 shadow-lg bg-amber-50' : 'border-slate-200 shadow-sm']">
        <div class="flex justify-between items-center mb-4">
          <input v-model="field.name" class="font-bold text-slate-700 text-lg bg-transparent border-b border-dashed border-slate-300 focus:border-emerald-500 focus:outline-none w-2/3">
          <button @click="safeDelete('field', field.id)" :class="['px-3 py-1.5 rounded-lg text-sm font-bold transition-colors active:scale-95', confirmDeleteId === field.id ? 'bg-red-500 text-white' : 'text-slate-400 bg-slate-100']">
            {{ confirmDeleteId === field.id ? '確定刪除?' : '✕' }}
          </button>
        </div>

        <div class="mb-5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
          <div class="flex justify-between items-center cursor-pointer select-none" @click="mergingFieldId = mergingFieldId === field.id ? null : field.id">
            <span class="text-sm font-bold text-slate-600">🔗 同步連動其他農田</span>
            <span class="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md font-bold" v-if="field.mergedGroupId">已開啟連動</span>
          </div>
          <div v-if="mergingFieldId === field.id" class="mt-4 flex flex-wrap gap-2 pt-4 border-t border-slate-200 animate-fade-in">
            <label v-for="otherField in fields.filter(f => f.id !== field.id)" :key="otherField.id" class="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-lg cursor-pointer active:scale-95 transition-all">
              <input type="checkbox" :checked="otherField.mergedGroupId === field.mergedGroupId && field.mergedGroupId !== null" @change="toggleMerge(otherField.id, field.id)" class="w-4 h-4 text-emerald-500 focus:ring-emerald-500 rounded">
              <span class="text-sm font-bold text-slate-600">{{ otherField.name }}</span>
            </label>
          </div>
        </div>

        <div class="relative">
          <label class="block text-xs font-bold text-slate-400 mb-1.5">目前種植作物</label>
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-base font-bold text-slate-700 cursor-pointer flex justify-between items-center" @click="openDropdowns[field.id] = !openDropdowns[field.id]">
            <span>{{ getCropName(field.currentCropId) }}</span>
            <span class="text-slate-400 transition-transform" :class="{'rotate-180': openDropdowns[field.id]}">▼</span>
          </div>
          
          <div v-if="openDropdowns[field.id]" class="absolute bottom-full mb-1 z-50 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
            <div class="p-2 border-b border-slate-100">
              <input type="text" v-model="searchQueries[field.id]" placeholder="搜尋作物..." class="w-full bg-slate-100 rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-500">
            </div>
            <div class="max-h-56 overflow-y-auto pb-2">
              <!-- 加入 .stop 阻止事件冒泡，並將農田狀態重置為 idle -->
              <div 
                class="px-4 py-3 text-base cursor-pointer text-slate-500 hover:bg-slate-50 active:bg-slate-100 flex items-center justify-between" 
                @click.stop="field.currentCropId = null; field.state = 'idle'; openDropdowns[field.id] = false">
                <span>休耕中 (無)</span>
                <span v-if="!field.currentCropId" class="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold">目前狀態</span>
              </div>
              <div 
                v-for="crop in crops.filter(c => !searchQueries[field.id] || c.name.includes(searchQueries[field.id]))" 
                :key="crop.id" 
                @click.stop="field.currentCropId = crop.id; openDropdowns[field.id] = false" 
                class="px-4 py-3 text-base cursor-pointer font-bold text-slate-700 hover:bg-emerald-50 active:bg-slate-100 border-t border-slate-50 flex items-center justify-between"
              >
                <span>{{ crop.name }}</span>
                <span v-if="field.currentCropId === crop.id" class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">選取中</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. 設施管理 -->
    <section v-if="activeSubTab === 'facilities'" class="space-y-4">
      <div class="flex gap-2">
        <input v-model="newFacilityName" placeholder="新工廠名稱..." class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none">
        <button @click="handleAddFacility" class="bg-blue-500 text-white px-5 py-3 rounded-xl font-bold active:scale-95 transition-all shadow-sm">新增</button>
      </div>

      <div class="relative">
        <span class="absolute left-3 top-3.5 text-slate-400">🔍</span>
        <input v-model="searchFacility" placeholder="搜尋設施名稱..." class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-3 text-base focus:ring-2 focus:ring-slate-300 outline-none">
      </div>

      <div v-for="facility in filteredAndSortedFacilities" :key="facility.id" :id="facility.id" :class="['bg-white p-4 rounded-2xl border transition-all duration-500', highlightedId === facility.id ? 'border-amber-400 shadow-lg bg-amber-50' : 'border-slate-200 shadow-sm']">
        <div class="flex justify-between items-center mb-3">
          <input v-model="facility.name" class="font-bold text-slate-700 text-lg bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none w-1/2">
          <div class="flex items-center gap-3">
            <label class="relative inline-flex items-center cursor-pointer active:scale-95">
              <input type="checkbox" v-model="facility.isOwned" class="sr-only peer">
              <div class="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
            <button @click="safeDelete('facility', facility.id)" :class="['px-3 py-1.5 rounded-lg text-sm font-bold transition-colors active:scale-95', confirmDeleteId === facility.id ? 'bg-red-500 text-white' : 'text-slate-400 bg-slate-100']">
              {{ confirmDeleteId === facility.id ? '確定刪除?' : '✕' }}
            </button>
          </div>
        </div>

        <!-- 巡視間隔設定 -->
        <div class="flex items-center gap-2 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span class="text-xs font-bold text-slate-500">巡視頻率：</span>
          <select v-model.number="facility.checkIntervalMonths" class="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-700 outline-none">
            <option :value="1">每 1 個月巡視一次</option>
            <option :value="2">每 2 個月巡視一次</option>
            <option :value="3">每 3 個月巡視一次</option>
            <option :value="4">每 4 個月巡視一次</option>
            <option :value="6">每 6 個月巡視一次</option>
          </select>
        </div>

        <div v-if="facility.isOwned" class="mt-3 pt-3 border-t border-slate-100">
          <div class="flex justify-between items-center mb-3">
            <p class="text-sm font-bold text-emerald-800">✅ 啟用的產線：</p>
            <button @click="editingFacilityId = editingFacilityId === facility.id ? null : facility.id" class="text-sm bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg active:scale-95 transition-all font-bold">
              {{ editingFacilityId === facility.id ? '完成編輯' : '✏️ 編輯總產線' }}
            </button>
          </div>
          
          <div class="flex flex-wrap gap-2">
            <span v-if="(facility.supportedProductIds || []).length === 0" class="text-xs text-slate-400 italic">點擊編輯新增支援產線</span>
            <label v-for="productId in facility.supportedProductIds" :key="'act_'+productId" class="flex items-center gap-2 bg-white border border-emerald-200 px-3.5 py-2 rounded-xl cursor-pointer shadow-sm active:scale-95 transition-all">
              <input type="checkbox" :value="productId" v-model="facility.activeProductIds" class="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500">
              <span class="text-sm font-bold text-emerald-900">{{ getProductName(productId) }}</span>
            </label>
          </div>

          <div v-if="editingFacilityId === facility.id" class="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl animate-fade-in shadow-inner">
            <p class="text-xs font-bold text-slate-500 mb-3">勾選此工廠支援的項目 (從全庫)：</p>
            <div class="flex flex-wrap gap-2">
              <label v-for="product in products" :key="'supp_'+product.id" class="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-lg cursor-pointer active:scale-95 transition-all">
                <input type="checkbox" :value="product.id" v-model="facility.supportedProductIds" class="w-4 h-4 text-blue-500 rounded focus:ring-blue-500">
                <span class="text-sm font-medium text-slate-600">{{ product.name }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. 產品管理 -->
    <section v-if="activeSubTab === 'products'" class="space-y-4">
      <div class="flex gap-2">
        <input v-model="newProductName" placeholder="新產品名稱..." class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-amber-500 outline-none">
        <button @click="handleAddProduct" class="bg-amber-500 text-white px-5 py-3 rounded-xl font-bold active:scale-95 transition-all shadow-sm">新增</button>
      </div>

      <div class="relative">
        <span class="absolute left-3 top-3.5 text-slate-400">🔍</span>
        <input v-model="searchProduct" placeholder="搜尋產品名稱..." class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-3 text-base focus:ring-2 focus:ring-slate-300 outline-none">
      </div>

      <div class="space-y-3">
        <div v-for="product in filteredAndSortedProducts" :key="product.id" :id="product.id" :class="['bg-white rounded-2xl border transition-all duration-500 overflow-hidden', highlightedId === product.id ? 'border-amber-400 shadow-lg bg-amber-50' : 'border-slate-200 shadow-sm']">
          <div class="flex justify-between items-center p-4 cursor-pointer active:bg-slate-50 transition-colors" @click="expandedItems[product.id] = !expandedItems[product.id]">
            <div class="flex items-center gap-3 w-1/2" @click.stop>
              <input v-model="product.name" class="font-bold text-slate-700 text-lg bg-transparent border-b border-dashed border-slate-300 w-full outline-none focus:border-amber-500 transition-colors">
            </div>
            <div class="flex items-center gap-2">
              <button @click.stop="toggleWatchPrice(product.id)" :class="['px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-90', isWatched(product.id) ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400 hover:text-slate-600']">
                {{ isWatched(product.id) ? '★ 已關注' : '☆ 關注' }}
              </button>
              <button @click.stop="safeDelete('product', product.id)" :class="['px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-95', confirmDeleteId === product.id ? 'bg-red-500 text-white' : 'text-slate-400 bg-slate-100']">
                {{ confirmDeleteId === product.id ? '確定刪除?' : '✕' }}
              </button>
              <span class="text-slate-400 transition-transform duration-300" :class="{'rotate-180': expandedItems[product.id]}">▼</span>
            </div>
          </div>
          
          <div v-if="expandedItems[product.id]" class="px-5 pb-5 animate-fade-in border-t border-slate-100 pt-4 bg-slate-50/50">
            <p class="text-sm font-bold text-slate-500 mb-3">💰 價格高點月份 (點選切換)：</p>
            <div class="grid grid-cols-6 gap-2">
              <button v-for="m in 12" :key="m" @click="toggleMonth(product.highPriceMonths, m)" :class="['aspect-square rounded-full text-base font-bold transition-all active:scale-75 shadow-sm flex items-center justify-center', (product.highPriceMonths || []).includes(m) ? 'bg-amber-500 text-white border-transparent' : 'bg-white text-slate-400 border border-slate-200']">
                {{ m }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. 作物管理 -->
    <section v-if="activeSubTab === 'crops'" class="space-y-4">
      <div class="flex gap-2">
        <input v-model="newCropName" placeholder="新 MOD 作物名稱..." class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-purple-500 outline-none">
        <button @click="handleAddCrop" class="bg-purple-500 text-white px-5 py-3 rounded-xl font-bold active:scale-95 transition-all shadow-sm">新增</button>
      </div>

      <div class="relative">
        <span class="absolute left-3 top-3.5 text-slate-400">🔍</span>
        <input v-model="searchCrop" placeholder="搜尋作物名稱..." class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-3 text-base focus:ring-2 focus:ring-slate-300 outline-none">
      </div>

      <div class="space-y-3">
        <div v-for="crop in filteredAndSortedCrops" :key="crop.id" :id="crop.id" :class="['bg-white rounded-2xl border transition-all duration-500 overflow-hidden', highlightedId === crop.id ? 'border-purple-400 shadow-lg bg-purple-50' : 'border-slate-200 shadow-sm']">
          <div class="flex justify-between items-center p-4 cursor-pointer active:bg-slate-50 transition-colors" @click="expandedItems[crop.id] = !expandedItems[crop.id]">
            <div class="flex items-center gap-3 w-1/2" @click.stop>
              <input v-model="crop.name" class="font-bold text-slate-700 text-lg bg-transparent border-b border-dashed border-slate-300 w-full outline-none focus:border-purple-500 transition-colors">
            </div>
            <div class="flex items-center gap-2">
              <button @click.stop="toggleWatchPrice(crop.id)" :class="['px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-90', isWatched(crop.id) ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400 hover:text-slate-600']">
                {{ isWatched(crop.id) ? '★ 已關注' : '☆ 關注' }}
              </button>
              <button @click.stop="safeDelete('crop', crop.id)" :class="['px-2.5 py-1.5 rounded-lg text-sm font-bold transition-colors active:scale-95', confirmDeleteId === crop.id ? 'bg-red-500 text-white' : 'text-slate-400 bg-slate-100']">
                {{ confirmDeleteId === crop.id ? '確定刪除?' : '✕' }}
              </button>
              <span class="text-slate-400 transition-transform duration-300" :class="{'rotate-180': expandedItems[crop.id]}">▼</span>
            </div>
          </div>
          
          <div v-if="expandedItems[crop.id]" class="px-5 pb-5 animate-fade-in border-t border-slate-100 pt-5 bg-slate-50/50">
            <!-- 播種月份 -->
            <div class="mb-5">
              <p class="text-sm font-bold text-slate-500 mb-3">🌱 適合播種月份：</p>
              <div class="grid grid-cols-6 gap-2">
                <button v-for="m in 12" :key="'sow_'+m" @click="toggleMonth(crop.sowingMonths, m)" :class="['aspect-square rounded-full text-base font-bold transition-all active:scale-75 shadow-sm flex items-center justify-center', (crop.sowingMonths || []).includes(m) ? 'bg-emerald-500 text-white border-transparent' : 'bg-white text-slate-400 border border-slate-200']">
                  {{ m }}
                </button>
              </div>
            </div>
            
            <!-- 收割月份 -->
            <div class="mb-5 pt-4 border-t border-slate-200/60">
              <p class="text-sm font-bold text-slate-500 mb-3">🌾 適合收割月份：</p>
              <div class="grid grid-cols-6 gap-2">
                <button v-for="m in 12" :key="'harv_'+m" @click="toggleMonth(crop.harvestMonths, m)" :class="['aspect-square rounded-full text-base font-bold transition-all active:scale-75 shadow-sm flex items-center justify-center', (crop.harvestMonths || []).includes(m) ? 'bg-orange-500 text-white border-transparent' : 'bg-white text-slate-400 border border-slate-200']">
                  {{ m }}
                </button>
              </div>
            </div>

            <!-- 價格高點月份 -->
            <div class="pt-4 border-t border-slate-200/60">
              <p class="text-sm font-bold text-slate-500 mb-3">💰 價格高點月份：</p>
              <div class="grid grid-cols-6 gap-2">
                <button v-for="m in 12" :key="'price_'+m" @click="toggleMonth(crop.highPriceMonths, m)" :class="['aspect-square rounded-full text-base font-bold transition-all active:scale-75 shadow-sm flex items-center justify-center', (crop.highPriceMonths || []).includes(m) ? 'bg-purple-500 text-white border-transparent' : 'bg-white text-slate-400 border border-slate-200']">
                  {{ m }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 重置按鈕 -->
    <section class="pt-6 pb-2">
      <button @click="resetData" class="w-full py-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 active:scale-95 transition-all shadow-sm">
        清除所有資料並恢復預設
      </button>
    </section>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
.animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>