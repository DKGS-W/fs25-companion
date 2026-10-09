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
    priceData: {
        basePrice: number;       // 遊戲中的基準價格 (通常是千升單價)
        peakSeason: string;      // 旺季的文字描述 (例如: "夏季")
        highPriceWindow: number[]; // 歷年來價格通常來到最高點的月份區間，例如 [6, 7, 8]
        alertThreshold: number;  // 警示倍率：當前價格 / 基準價 >= 這個數字 (如 1.15) 時，就會跳出賣出提醒
    };
}

/**
 * 2. 加工品與畜牧產品 (Product)
 * 那些無法靠播種收割，而是需要透過工廠或動物產出的項目
 */
export interface Product {
    id: string;                // 產品的唯一英文代碼 (例如: "clothes")
    name: string;              // 顯示的中文名稱 (例如: "衣服")
    category: 'livestock' | 'factory'; // 種類分類：livestock (畜牧業) 或 factory (加工廠)
    checkIntervalMonths: number; // 你希望 App 多久提醒你去巡一次這個工廠？(單位：月)
    priceData: {
        basePrice: number;       // 產品的基準價格
        highPriceWindow: number[]; // 產品高價位區間的月份
        alertThreshold: number;  // 警示倍率 (如 1.05 表示高於底價 5% 就要注意)
    };
}

/**
 * 3. 農田狀態列舉 (FieldState)
 * 限制農田只能處於這些特定的狀態之一，防止我們輸入錯字
 */
export type FieldState = 'idle' | 'seeded' | 'fertilized_1' | 'fertilized_2' | 'ready_to_harvest';

/**
 * 4. 你的實際農田與經營狀況 (Field)
 * 記錄你遊戲中每一塊田現在正在做什麼
 */
export interface Field {
    id: string;                // 系統辨識用的田地 ID
    name: string;              // 顯示給你看的名稱，例如："3, 4, 5 合併田"
    currentCropId: string | null; // 目前種植的作物 ID (與上面的 Crop ID 對應)，若空著則為 null
    state: FieldState;         // 這塊田目前的狀態
    plantedMonth: number | null; // 記錄是在幾月播種的，用來讓系統推算何時能收成
    mergedGroupId: string | null; // 合併群組 ID，如果 3, 4, 5 號田被合併了，這三塊田的 mergedGroupId 都會被設定為 "group_345"。若沒有合併（獨立運作），此欄位為 null。
}

/**
 * 5. 待辦事項 (Task)
 * 這是你的 App 介面上最終會印出來的「任務卡片」型別
 */
export interface Task {
    id: string;                // 任務的隨機產生 ID
    month: number;             // 這個任務是屬於遊戲中哪一個月的
    type: 'sow' | 'harvest' | 'sell' | 'check_facility'; // 任務種類：播種、收割、販賣、檢查設施
    title: string;             // 任務顯示的文字，例如："準備收割水稻 (8號田)"
    isCompleted: boolean;      // 記錄這個任務是否已經被你打勾完成了
    relatedEntityId: string;   // 這個任務關聯到哪一塊田或哪一個工廠，方便尋找
}