// src/types/index.ts

/**
 * 1. 作物基本資料 (Crop)
 * 定義了 FS25 遊戲中每一種農作物的基礎生長與市場價格屬性
 */
export interface Crop {
    id: string;                // 作物的唯一英文代碼 (例如: "rice", "wheat")
    name: string;              // 介面上顯示的中文名稱 (例如: "水稻", "小麥")
    sowingMonths: number[];    // 適合播種的月份清單，例如 [4, 5] 代表 4 月到 5 月
    harvestMonths: number[];   // 可以收割的月份清單，例如 [8, 9] 代表 8 月到 9 月
    highPriceMonths: number[]; // 歷年來價格通常來到最高點的月份區間，例如 [6, 7, 8]
    growthMonths: number;     // 生長週期所需月數
    isRecurring: boolean;     // 是否為宿根/多年生作物（收割後自動重新生長，免重複播種）
}

/**
 * 2. 加工品與畜牧產品 (Product)
 * 那些無法靠播種收割，而是需要透過工廠或動物產出的項目
 */
export interface Product {
    id: string;                // 產品的唯一英文代碼 (例如: "clothes")
    name: string;              // 顯示的中文名稱 (例如: "衣服")
    category: 'livestock' | 'factory'; // 種類分類：livestock (畜牧業) 或 factory (加工廠)
    highPriceMonths: number[]; // 產品高價位區間的月份
}

export interface Facility {
    id: string;
    name: string;                // 設備/工廠名稱 (ex. 穀物磨坊、紡織廠)
    isOwned: boolean;            // 判斷你是否已經買了這個設施
    checkIntervalMonths: number; // 幾個月巡邏一次
    supportedProductIds: string[]; // 【新增】這座工廠天生能生產的所有產品 ID
    activeProductIds: string[];// 這個設施會產出哪些產品 (陣列)
}

/**
 * 3. 農田狀態列舉 (FieldState)
 * 限制農田只能處於這些特定的狀態之一，防止我們輸入錯字
 */
export type FieldState = 'idle' | 'cover_crop_seeded' | 'idle_fertilized' | 'seeded' | 'fertilized_1' | 'fertilized_2' | 'ready_to_harvest';

/**
 * 4. 你的實際農田與經營狀況 (Field)
 * 記錄你遊戲中每一塊田現在正在做什麼
 */
export interface Field {
    id: string;                // 系統辨識用的田地 ID
    name: string;              // 顯示給你看的名稱，例如："3, 4, 5 合併田"
    currentCropId: string | null; // 目前種植的作物 ID (與上面的 Crop ID 對應)，若空著則為 null
    rotationCropId?: string | null;     // 輪作作物 ID
    plantedCropId?: string | null;      // 目前田裡種植的作物 ID
    state: FieldState;         // 這塊田目前的狀態
    plantedMonth?: number | null;        // 記錄播種月份
    lastFertilizedMonth?: number | null; // 記錄最近施肥月份（用於隔月施肥判斷）
    harvestedMonth?: number | null;      // 記錄收割月份
    mergedGroupId: string | null; // 合併群組 ID，如果 3, 4, 5 號田被合併了，這三塊田的 mergedGroupId 都會被設定為 "group_345"。若沒有合併（獨立運作），此欄位為 null。
    enableGreenManure?: boolean; // 綠肥提醒獨立開關
}

/**
 * 5. 待辦事項 (Task)
 * 這是你的 App 介面上最終會印出來的「任務卡片」型別
 */
export interface Task {
    id: string;                // 任務的隨機產生 ID
    month: number;             // 這個任務是屬於遊戲中哪一個月的
    type: 'sow' | 'harvest' | 'sell' | 'check_facility' | 'fertilize'; // 任務種類：播種、收割、販賣、檢查設施、施肥
    title: string;             // 任務顯示的文字，例如："準備收割水稻 (8號田)"
    isCompleted: boolean;      // 記錄這個任務是否已經被你打勾完成了
    relatedEntityId: string;   // 這個任務關聯到哪一塊田或哪一個工廠，方便尋找
}