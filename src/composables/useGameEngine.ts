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
const savedClearedWindows = localStorage.getItem('fs25_cleared_price_windows')

const formatFields = (raw: any[]): Field[] => (raw || []).map(f => ({
    id: f.id,
    name: f.name,
    currentCropId: f.currentCropId ?? null,
    rotationCropId: f.rotationCropId ?? null,
    plantedCropId: f.plantedCropId ?? null,
    state: f.state ?? 'idle',
    plantedMonth: f.plantedMonth ?? null,
    lastFertilizedMonth: f.lastFertilizedMonth ?? null,
    harvestedMonth: f.harvestedMonth ?? null,
    mergedGroupId: f.mergedGroupId ?? null,
    enableGreenManure: f.enableGreenManure ?? false
}))

const formatCrops = (raw: any[]): Crop[] => (raw || []).map(c => ({
    id: c.id,
    name: c.name,
    sowingMonths: c.sowingMonths || [],
    harvestMonths: c.harvestMonths || [],
    highPriceMonths: c.highPriceMonths || [],
    growthMonths: typeof c.growthMonths === 'number' ? c.growthMonths : 4,
    isRecurring: !!c.isRecurring
}))

const formatProducts = (raw: any[]): Product[] => (raw || []).map(p => ({
    id: p.id,
    name: p.name,
    category: p.category || 'factory',
    highPriceMonths: p.highPriceMonths || []
}))

const currentMonth = ref(savedMonth ? parseInt(savedMonth) : 8)
const fields = ref<Field[]>(savedFields ? formatFields(JSON.parse(savedFields)) : formatFields(db.fields || []))
const facilities = ref<Facility[]>(savedFacilities ? JSON.parse(savedFacilities) : (db.facilities as Facility[]))
const crops = ref<Crop[]>(savedCrops ? JSON.parse(savedCrops) : formatCrops(db.crops || []))
const products = ref<Product[]>(savedProducts ? JSON.parse(savedProducts) : formatProducts(db.products || []))
const tasks = ref<Task[]>(savedTasks ? JSON.parse(savedTasks) : [])
const watchedPriceIds = ref<string[]>(savedWatchedPrices ? JSON.parse(savedWatchedPrices) : [])
const clearedPriceWindows = ref<string[]>(savedClearedWindows ? JSON.parse(savedClearedWindows) : [])

export function useGameEngine() {
    const nextMonth = () => { currentMonth.value = currentMonth.value === 12 ? 1 : currentMonth.value + 1 }
    const prevMonth = () => { currentMonth.value = currentMonth.value === 1 ? 12 : currentMonth.value - 1 }
    const setMonth = (month: number) => { if (month >= 1 && month <= 12) currentMonth.value = month }

    const getPriceWindow = (highPriceMonths: number[], targetMonth: number): number[] => {
        if (!highPriceMonths.includes(targetMonth)) return []
        const windowSet = new Set<number>([targetMonth])
        let prev = (targetMonth - 2 + 12) % 12 + 1
        while (highPriceMonths.includes(prev) && !windowSet.has(prev)) {
            windowSet.add(prev)
            prev = (prev - 2 + 12) % 12 + 1
        }
        let next = targetMonth % 12 + 1
        while (highPriceMonths.includes(next) && !windowSet.has(next)) {
            windowSet.add(next)
            next = next % 12 + 1
        }
        return Array.from(windowSet).sort((a, b) => a - b)
    }

    const getPriceWindowKey = (entityId: string, highPriceMonths: number[], month: number): string => {
        const win = getPriceWindow(highPriceMonths, month)
        if (win.length === 0) return ''
        return `${entityId}_${win.join('-')}`
    }

    const createTask = (id: string, month: number, type: Task['type'], title: string, relatedEntityId: string, isCompleted = false): Task => ({
        id, month, type, title, relatedEntityId, isCompleted
    })

    const generateTasks = () => {
        const newTasks: Task[] = []
        const month = currentMonth.value

        clearedPriceWindows.value = clearedPriceWindows.value.filter(key => {
            const parts = key.split('_')
            const winMonths = parts.slice(1).join('_').split('-').map(Number)
            return winMonths.includes(month)
        })

        const existingCompletedNonFieldTasks = new Set(
            tasks.value.filter(t => t.month === month && t.isCompleted && !t.id.startsWith('sow') && !t.id.startsWith('fertilize') && !t.id.startsWith('harvest_') && !t.id.startsWith('green_')).map(t => t.id)
        )

        // 1. 農田提醒
        fields.value.forEach(field => {
            if (!field.currentCropId) return
            const crop = crops.value.find(c => c.id === field.currentCropId)
            if (!crop) return

            // 當前田裡實際生長的作物（若剛播了輪作作物則依據 plantedCropId）
            const activeCropId = field.plantedCropId || field.currentCropId
            const activeCrop = crops.value.find(c => c.id === activeCropId) || crop

            const isRecurring = !!activeCrop.isRecurring
            const reqGrowth = activeCrop.growthMonths || 1

            const elapsedGrowthMonths = field.plantedMonth !== null && field.plantedMonth !== undefined
                ? (month - field.plantedMonth + 12) % 12
                : null

            const isReadyToSow = field.state === 'idle' || field.state === 'idle_fertilized'

            // A. 主作物播種
            if (isReadyToSow && (crop.sowingMonths || []).includes(month)) {
                newTasks.push(createTask(`sow_${field.id}_${month}`, month, 'sow', `播種 ${crop.name} (${field.name})`, field.id, false))
            } else if (['seeded', 'fertilized_1', 'fertilized_2'].includes(field.state) && field.plantedMonth === month && !isRecurring && field.plantedCropId === crop.id) {
                newTasks.push(createTask(`sow_${field.id}_${month}`, month, 'sow', `播種 ${crop.name} (${field.name})`, field.id, true))
            }

            // B. 輪作作物播種 (若有設定輪作作物且當月為其播種月)
            if (field.rotationCropId) {
                const rotationCrop = crops.value.find(c => c.id === field.rotationCropId)
                if (rotationCrop) {
                    if (isReadyToSow && (rotationCrop.sowingMonths || []).includes(month)) {
                        newTasks.push(createTask(`sow_rotation_${field.id}_${month}`, month, 'sow', `[輪作] 播種 ${rotationCrop.name} (${field.name})`, field.id, false))
                    } else if (['seeded', 'fertilized_1', 'fertilized_2'].includes(field.state) && field.plantedMonth === month && field.plantedCropId === rotationCrop.id) {
                        newTasks.push(createTask(`sow_rotation_${field.id}_${month}`, month, 'sow', `[輪作] 播種 ${rotationCrop.name} (${field.name})`, field.id, true))
                    }
                }
            }

            // C. 綠肥提醒
            if (field.enableGreenManure) {
                const greenManureSowMonths = [3, 4, 5, 6, 7, 8, 9, 10]
                if (field.state === 'idle' && !(crop.sowingMonths || []).includes(month) && greenManureSowMonths.includes(month)) {
                    newTasks.push(createTask(`green_sow_${field.id}_${month}`, month, 'sow', `🌱 [綠肥] 播種油菜籽蘿蔔 (${field.name})`, field.id, false))
                } else if (field.state === 'cover_crop_seeded' && field.plantedMonth === month) {
                    newTasks.push(createTask(`green_sow_${field.id}_${month}`, month, 'sow', `🌱 [綠肥] 播種油菜籽蘿蔔 (${field.name})`, field.id, true))
                }

                if (field.state === 'cover_crop_seeded' && field.plantedMonth !== month) {
                    newTasks.push(createTask(`green_cultivate_${field.id}_${month}`, month, 'fertilize', `🚜 翻耕綠肥 (${field.name})`, field.id, false))
                } else if (field.state === 'idle_fertilized' && field.lastFertilizedMonth === month) {
                    newTasks.push(createTask(`green_cultivate_${field.id}_${month}`, month, 'fertilize', `🚜 翻耕綠肥 (${field.name})`, field.id, true))
                }
            }

            // D. 主作物 / 輪作作物第 1 次施肥
            if (field.state === 'seeded') {
                newTasks.push(createTask(`fertilize1_${field.id}_${month}`, month, 'fertilize', `第 1 次施肥 (${field.name})`, field.id, false))
            } else if (field.state === 'fertilized_1' && field.lastFertilizedMonth === month && field.plantedMonth === month) {
                newTasks.push(createTask(`fertilize1_${field.id}_${month}`, month, 'fertilize', `第 1 次施肥 (${field.name})`, field.id, true))
            }

            // E. 第 2 次施肥 (隔月判定)
            if (field.state === 'fertilized_1' && field.lastFertilizedMonth !== month && !(activeCrop.harvestMonths || []).includes(month)) {
                newTasks.push(createTask(`fertilize2_${field.id}_${month}`, month, 'fertilize', `第 2 次施肥 (${field.name})`, field.id, false))
            } else if (field.state === 'fertilized_2' && field.lastFertilizedMonth === month) {
                newTasks.push(createTask(`fertilize2_${field.id}_${month}`, month, 'fertilize', `第 2 次施肥 (${field.name})`, field.id, true))
            }

            // F. 收割任務 (依據 activeCrop 生長狀況判斷)
            const isHarvestMonth = (activeCrop.harvestMonths || []).includes(month)
            const isFullyGrown = elapsedGrowthMonths !== null ? elapsedGrowthMonths >= reqGrowth : true
            const isNotJustSownThisMonth = field.plantedMonth !== month

            if (isHarvestMonth && isFullyGrown && isNotJustSownThisMonth) {
                if (!['idle', 'cover_crop_seeded', 'idle_fertilized'].includes(field.state)) {
                    newTasks.push(createTask(`harvest_${field.id}_${month}`, month, 'harvest', `收割 ${activeCrop.name} (${field.name})`, field.id, false))
                } else if (field.harvestedMonth === month) {
                    newTasks.push(createTask(`harvest_${field.id}_${month}`, month, 'harvest', `收割 ${activeCrop.name} (${field.name})`, field.id, true))
                }
            }
        })

        // 2. 作物高價提醒
        crops.value.forEach(crop => {
            const isWatched = (watchedPriceIds.value || []).includes(crop.id)
            if (isWatched && (crop.highPriceMonths || []).includes(month)) {
                const winKey = getPriceWindowKey(crop.id, crop.highPriceMonths, month)
                if (clearedPriceWindows.value.includes(winKey)) return

                const taskId = `sell_crop_${crop.id}_${month}`
                newTasks.push(createTask(taskId, month, 'sell', `高價：${crop.name}`, crop.id, existingCompletedNonFieldTasks.has(taskId)))
            }
        })

        // 3. 產品高價提醒
        products.value.forEach(product => {
            const isWatched = (watchedPriceIds.value || []).includes(product.id)
            if (isWatched && (product.highPriceMonths || []).includes(month)) {
                const winKey = getPriceWindowKey(product.id, product.highPriceMonths, month)
                if (clearedPriceWindows.value.includes(winKey)) return

                const taskId = `sell_product_${product.id}_${month}`
                newTasks.push(createTask(taskId, month, 'sell', `高價：${product.name}`, product.id, existingCompletedNonFieldTasks.has(taskId)))
            }
        })

        // 4. 設施巡視提醒
        facilities.value.forEach(facility => {
            const interval = facility.checkIntervalMonths || 2
            if (facility.isOwned && (facility.activeProductIds || []).length > 0 && month % interval === 0) {
                const taskId = `check_facility_${facility.id}_${month}`
                newTasks.push(createTask(taskId, month, 'check_facility', `巡視：${facility.name}`, facility.id, existingCompletedNonFieldTasks.has(taskId)))
            }
        })

        tasks.value = newTasks
    }

    watch(currentMonth, (val) => { localStorage.setItem('fs25_currentMonth', val.toString()); generateTasks() }, { immediate: !savedTasks })
    watch(tasks, (val) => localStorage.setItem('fs25_tasks', JSON.stringify(val)), { deep: true })
    watch(fields, (val) => { localStorage.setItem('fs25_fields', JSON.stringify(val)); generateTasks() }, { deep: true })
    watch(facilities, (val) => { localStorage.setItem('fs25_facilities', JSON.stringify(val)); generateTasks() }, { deep: true })
    watch(crops, (val) => { localStorage.setItem('fs25_crops', JSON.stringify(val)); generateTasks() }, { deep: true })
    watch(products, (val) => { localStorage.setItem('fs25_products', JSON.stringify(val)); generateTasks() }, { deep: true })
    watch(watchedPriceIds, (val) => { localStorage.setItem('fs25_watched_prices', JSON.stringify(val)); generateTasks() }, { deep: true })
    watch(clearedPriceWindows, (val) => { localStorage.setItem('fs25_cleared_price_windows', JSON.stringify(val)) }, { deep: true })

    // 核心：普通點擊任務
    const toggleTask = (taskId: string) => {
        const targetTask = tasks.value.find(t => t.id === taskId)
        if (!targetTask) return

        const willBeCompleted = !targetTask.isCompleted
        const targetField = fields.value.find(f => f.id === targetTask.relatedEntityId)

        if (targetField) {
            const targetFields = targetField.mergedGroupId
                ? fields.value.filter(f => f.mergedGroupId === targetField.mergedGroupId)
                : [targetField]

            targetFields.forEach(f => {
                const crop = crops.value.find(c => c.id === f.currentCropId)
                const isRecurring = crop ? !!crop.isRecurring : false

                if (taskId.startsWith('green_sow_')) {
                    if (willBeCompleted) {
                        f.state = 'cover_crop_seeded'
                        f.plantedMonth = currentMonth.value
                    } else {
                        f.state = 'idle'
                        f.plantedMonth = null
                    }
                } else if (taskId.startsWith('green_cultivate_')) {
                    if (willBeCompleted) {
                        f.state = 'idle_fertilized'
                        f.lastFertilizedMonth = currentMonth.value
                    } else {
                        f.state = 'cover_crop_seeded'
                    }
                } else if (targetTask.type === 'sow') {
                    if (willBeCompleted) {
                        const cropToPlant = taskId.startsWith('sow_rotation_') ? f.rotationCropId : f.currentCropId
                        f.plantedCropId = cropToPlant
                        if (f.state === 'idle_fertilized') {
                            f.state = 'fertilized_1'
                            f.lastFertilizedMonth = currentMonth.value
                        } else {
                            f.state = 'seeded'
                        }
                        f.plantedMonth = currentMonth.value
                        f.harvestedMonth = null
                    } else {
                        f.state = 'idle'
                        f.plantedCropId = null
                        f.plantedMonth = null
                        f.lastFertilizedMonth = null
                    }
                } else if (targetTask.type === 'fertilize') {
                    if (taskId.startsWith('fertilize1_')) {
                        if (willBeCompleted) {
                            f.state = 'fertilized_1'
                            f.lastFertilizedMonth = currentMonth.value
                        } else {
                            f.state = 'seeded'
                            f.lastFertilizedMonth = null
                        }
                    } else if (taskId.startsWith('fertilize2_')) {
                        if (willBeCompleted) {
                            f.state = 'fertilized_2'
                            f.lastFertilizedMonth = currentMonth.value
                        } else {
                            f.state = 'fertilized_1'
                            f.lastFertilizedMonth = f.plantedMonth
                        }
                    }
                } else if (targetTask.type === 'harvest') {
                    if (willBeCompleted) {
                        f.harvestedMonth = currentMonth.value
                        if (isRecurring) {
                            f.state = 'seeded'
                            f.plantedMonth = currentMonth.value
                            f.lastFertilizedMonth = null
                        } else {
                            f.state = 'idle'
                            f.plantedCropId = null
                            f.plantedMonth = null
                            f.lastFertilizedMonth = null
                        }
                    } else {
                        f.harvestedMonth = null
                        f.state = 'fertilized_2'
                    }
                }
            })
        } else {
            targetTask.isCompleted = willBeCompleted
        }
    }

    // 專屬：帶有施肥機的播種機快捷操作（自動跳過第 1 次施肥）
    const sowWithFertilizer = (taskId: string) => {
        const targetTask = tasks.value.find(t => t.id === taskId)
        if (!targetTask) return
        const targetField = fields.value.find(f => f.id === targetTask.relatedEntityId)
        if (!targetField) return

        const targetFields = targetField.mergedGroupId
            ? fields.value.filter(f => f.mergedGroupId === targetField.mergedGroupId)
            : [targetField]

        targetFields.forEach(f => {
            const cropToPlant = taskId.startsWith('sow_rotation_') ? f.rotationCropId : f.currentCropId
            f.plantedCropId = cropToPlant
            f.plantedMonth = currentMonth.value
            f.lastFertilizedMonth = currentMonth.value // 標記為當月已施肥
            f.state = 'fertilized_1'                  // 直接推進到已施肥 1 次狀態！
            f.harvestedMonth = null
        })

        targetTask.isCompleted = true
    }

    const markPriceWindowCleared = (entityId: string) => {
        const item = crops.value.find(c => c.id === entityId) || products.value.find(p => p.id === entityId)
        if (!item) return
        const winKey = getPriceWindowKey(entityId, item.highPriceMonths || [], currentMonth.value)
        if (winKey && !clearedPriceWindows.value.includes(winKey)) {
            clearedPriceWindows.value.push(winKey)
            generateTasks()
        }
    }

    const updateFieldState = (fieldId: string, newState: Field['state']) => {
        const target = fields.value.find(f => f.id === fieldId)
        if (!target) return
        const group = target.mergedGroupId
            ? fields.value.filter(f => f.mergedGroupId === target.mergedGroupId)
            : [target]
        group.forEach(f => {
            f.state = newState
            if (newState === 'idle') {
                f.plantedCropId = null
                f.plantedMonth = null
                f.lastFertilizedMonth = null
                f.harvestedMonth = null
            } else if (['seeded', 'cover_crop_seeded'].includes(newState)) {
                f.plantedMonth = currentMonth.value
            } else if (['fertilized_1', 'fertilized_2'].includes(newState)) {
                f.lastFertilizedMonth = currentMonth.value
            }
        })
    }

    const updateFieldCrop = (fieldId: string, newCropId: string | null) => {
        const target = fields.value.find(f => f.id === fieldId)
        if (!target) return
        const group = target.mergedGroupId
            ? fields.value.filter(f => f.mergedGroupId === target.mergedGroupId)
            : [target]
        group.forEach(f => {
            f.currentCropId = newCropId
            f.rotationCropId = null // 更換主作物時重置輪作選擇
        })
        if (newCropId) autoWatchIfNew(newCropId)
    }

    const updateFieldRotationCrop = (fieldId: string, newRotationCropId: string | null) => {
        const target = fields.value.find(f => f.id === fieldId)
        if (!target) return
        const group = target.mergedGroupId
            ? fields.value.filter(f => f.mergedGroupId === target.mergedGroupId)
            : [target]
        group.forEach(f => { f.rotationCropId = newRotationCropId })
        if (newRotationCropId) autoWatchIfNew(newRotationCropId)
    }

    const toggleFieldGreenManure = (fieldId: string) => {
        const target = fields.value.find(f => f.id === fieldId)
        if (!target) return
        const group = target.mergedGroupId
            ? fields.value.filter(f => f.mergedGroupId === target.mergedGroupId)
            : [target]
        const nextVal = !target.enableGreenManure
        group.forEach(f => { f.enableGreenManure = nextVal })
    }

    const autoWatchIfNew = (id: string | null) => {
        if (!id) return
        if (!watchedPriceIds.value) watchedPriceIds.value = []
        if (!watchedPriceIds.value.includes(id)) {
            watchedPriceIds.value.push(id)
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
        fields.value.push({
            id: newId,
            name,
            currentCropId: null,
            rotationCropId: null,
            plantedCropId: null,
            state: 'idle',
            plantedMonth: null,
            lastFertilizedMonth: null,
            harvestedMonth: null,
            mergedGroupId: null,
            enableGreenManure: false
        })
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
            crops.value.push({
                id: newId,
                name,
                sowingMonths: [1],
                harvestMonths: [6],
                highPriceMonths: [],
                growthMonths: 4,
                isRecurring: false
            })
        } else {
            products.value.push({ id: newId, name, category: 'factory', highPriceMonths: [] })
        }
        return newId
    }
    const removeProduct = (id: string, isCrop: boolean) => {
        if (isCrop) crops.value = crops.value.filter(c => c.id !== id)
        else products.value = products.value.filter(p => p.id !== id)
    }
    const resetData = () => { localStorage.clear(); location.reload() }

    return {
        currentMonth, tasks, fields, facilities, crops, products, watchedPriceIds, clearedPriceWindows,
        nextMonth, prevMonth, setMonth, toggleTask, sowWithFertilizer, toggleWatchPrice, autoWatchIfNew,
        markPriceWindowCleared, updateFieldState, updateFieldCrop, updateFieldRotationCrop, toggleFieldGreenManure,
        addField, removeField, addFacility, removeFacility, addProduct, removeProduct, resetData
    }
}