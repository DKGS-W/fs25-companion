// src/composables/useGameEngine.ts
import { ref, watch } from 'vue'
import type { Crop, Field, Product, Facility, Task } from '../types'
import db from '../data/db.json'

const savedMonth = localStorage.getItem('fs25_currentMonth')
const savedTasks = localStorage.getItem('fs25_tasks')
const savedFields = localStorage.getItem('fs25_fields')
const savedFacilities = localStorage.getItem('fs25_facilities')
const savedCrops = localStorage.getItem('fs25_crops')
const savedProducts = localStorage.getItem('fs25_products')
const savedWatchedPrices = localStorage.getItem('fs25_watched_prices')

const currentMonth = ref(savedMonth ? parseInt(savedMonth) : 8)
const fields = ref<Field[]>(savedFields ? JSON.parse(savedFields) : (db.fields as Field[]))
const facilities = ref<Facility[]>(savedFacilities ? JSON.parse(savedFacilities) : (db.facilities as Facility[]))

const formatCrops = (raw: any[]): Crop[] => raw.map(c => ({
    id: c.id,
    name: c.name,
    sowingMonths: c.sowingMonths || [],
    harvestMonths: c.harvestMonths || [],
    highPriceMonths: c.highPriceMonths || c.priceData?.highPriceWindow || []
}))

const formatProducts = (raw: any[]): Product[] => raw.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category || 'factory',
    highPriceMonths: p.highPriceMonths || p.priceData?.highPriceWindow || []
}))

const crops = ref<Crop[]>(savedCrops ? JSON.parse(savedCrops) : formatCrops(db.crops || []))
const products = ref<Product[]>(savedProducts ? JSON.parse(savedProducts) : formatProducts(db.products || []))
const tasks = ref<Task[]>(savedTasks ? JSON.parse(savedTasks) : [])
const watchedPriceIds = ref<string[]>(savedWatchedPrices ? JSON.parse(savedWatchedPrices) : [])

export function useGameEngine() {
    const nextMonth = () => { currentMonth.value = currentMonth.value === 12 ? 1 : currentMonth.value + 1 }
    const prevMonth = () => { currentMonth.value = currentMonth.value === 1 ? 12 : currentMonth.value - 1 }
    const setMonth = (month: number) => { if (month >= 1 && month <= 12) currentMonth.value = month }

    // 1. 必須先定義輔助與產生任務函數，才能在 watch 裡面呼叫
    const createTask = (id: string, month: number, type: Task['type'], title: string, relatedEntityId: string): Task => ({
        id, month, type, title, relatedEntityId, isCompleted: false
    })

    const generateTasks = () => {
        const newTasks: Task[] = []
        const month = currentMonth.value

        // 1. 農田提醒
        fields.value.forEach(field => {
            if (!field.currentCropId) return
            const crop = crops.value.find(c => c.id === field.currentCropId)
            if (!crop) return
            if (field.state === 'idle' && (crop.sowingMonths || []).includes(month)) {
                newTasks.push(createTask(`sow_${field.id}_${month}`, month, 'sow', `播種 ${crop.name} (${field.name})`, field.id))
            }
            if (field.state === 'seeded') {
                newTasks.push(createTask(`fertilize1_${field.id}_${month}`, month, 'fertilize', `第 1 次施肥 (${field.name})`, field.id))
            }
            if (field.state === 'fertilized_1') {
                newTasks.push(createTask(`fertilize2_${field.id}_${month}`, month, 'fertilize', `第 2 次施肥 (${field.name})`, field.id))
            }
            if (field.state !== 'idle' && (crop.harvestMonths || []).includes(month)) {
                newTasks.push(createTask(`harvest_${field.id}_${month}`, month, 'harvest', `收割 ${crop.name} (${field.name})`, field.id))
            }
        })

        // 2. 作物高價提醒
        const activeCropIds = new Set(fields.value.map(f => f.currentCropId).filter(Boolean))
        crops.value.forEach(crop => {
            const isWatched = activeCropIds.has(crop.id) || (watchedPriceIds.value || []).includes(crop.id)
            if (isWatched && (crop.highPriceMonths || []).includes(month)) {
                newTasks.push(createTask(`sell_crop_${crop.id}_${month}`, month, 'sell', `高價：${crop.name}`, crop.id))
            }
        })

        // 3. 產品高價提醒
        const activeProductIds = new Set(facilities.value.filter(fac => fac.isOwned).flatMap(fac => fac.activeProductIds || []))
        products.value.forEach(product => {
            const isWatched = activeProductIds.has(product.id) || (watchedPriceIds.value || []).includes(product.id)
            if (isWatched && (product.highPriceMonths || []).includes(month)) {
                newTasks.push(createTask(`sell_product_${product.id}_${month}`, month, 'sell', `高價：${product.name}`, product.id))
            }
        })

        // 4. 設施巡視提醒
        facilities.value.forEach(facility => {
            const interval = facility.checkIntervalMonths || 1
            if (facility.isOwned && (facility.activeProductIds || []).length > 0 && month % interval === 0) {
                newTasks.push(createTask(`check_facility_${facility.id}_${month}`, month, 'check_facility', `巡視：${facility.name}`, facility.id))
            }
        })

        tasks.value = newTasks
    }

    // 2. 再定義 watch 監聽器
    watch(currentMonth, (val) => { localStorage.setItem('fs25_currentMonth', val.toString()); generateTasks() }, { immediate: !savedTasks })
    watch(tasks, (val) => localStorage.setItem('fs25_tasks', JSON.stringify(val)), { deep: true })
    watch(fields, (val) => { localStorage.setItem('fs25_fields', JSON.stringify(val)); generateTasks() }, { deep: true })
    watch(facilities, (val) => { localStorage.setItem('fs25_facilities', JSON.stringify(val)); generateTasks() }, { deep: true })
    watch(crops, (val) => { localStorage.setItem('fs25_crops', JSON.stringify(val)); generateTasks() }, { deep: true })
    watch(products, (val) => { localStorage.setItem('fs25_products', JSON.stringify(val)); generateTasks() }, { deep: true })
    watch(watchedPriceIds, (val) => { localStorage.setItem('fs25_watched_prices', JSON.stringify(val)); generateTasks() }, { deep: true })

    const toggleTask = (taskId: string) => {
        const targetTask = tasks.value.find(t => t.id === taskId)
        if (!targetTask) return
        const newState = !targetTask.isCompleted
        targetTask.isCompleted = newState

        const relatedField = fields.value.find(f => f.id === targetTask.relatedEntityId)
        if (relatedField && relatedField.mergedGroupId) {
            const mergedFieldIds = fields.value.filter(f => f.mergedGroupId === relatedField.mergedGroupId).map(f => f.id)
            tasks.value.forEach(t => {
                if (t.type === targetTask.type && mergedFieldIds.includes(t.relatedEntityId)) t.isCompleted = newState
            })
        }
    }

    const toggleWatchPrice = (id: string) => {
        if (!watchedPriceIds.value) watchedPriceIds.value = []
        const idx = watchedPriceIds.value.indexOf(id)
        if (idx > -1) watchedPriceIds.value.splice(idx, 1)
        else watchedPriceIds.value.push(id)
    }

    const addField = (name: string) => {
        const newId = `field_${Date.now()}`
        fields.value.push({ id: newId, name, currentCropId: null, state: 'idle', mergedGroupId: null })
        return newId
    }
    const removeField = (id: string) => { fields.value = fields.value.filter(f => f.id !== id) }

    const addFacility = (name: string) => {
        const newId = `fac_${Date.now()}`
        facilities.value.push({ id: newId, name, isOwned: true, checkIntervalMonths: 2, supportedProductIds: [], activeProductIds: [] })
        return newId
    }
    const removeFacility = (id: string) => { facilities.value = facilities.value.filter(f => f.id !== id) }

    const addProduct = (name: string, isCrop: boolean) => {
        const newId = isCrop ? `crop_${Date.now()}` : `prod_${Date.now()}`
        if (isCrop) {
            crops.value.push({ id: newId, name, sowingMonths: [1], harvestMonths: [6], highPriceMonths: [] })
        } else {
            products.value.push({ id: newId, name, category: 'factory', highPriceMonths: [] })
        }
        return newId
    }
    const removeProduct = (id: string, isCrop: boolean) => {
        if (isCrop) crops.value = crops.value.filter(c => c.id !== id)
        else products.value = products.value.filter(p => p.id !== id)
    }

    const resetData = () => {
        localStorage.clear()
        location.reload()
    }

    return {
        currentMonth, tasks, fields, facilities, crops, products, watchedPriceIds,
        nextMonth, prevMonth, setMonth, toggleTask, toggleWatchPrice,
        addField, removeField, addFacility, removeFacility, addProduct, removeProduct, resetData
    }
}