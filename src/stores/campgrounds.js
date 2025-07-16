// src/stores/campgrounds.js
import { ref } from 'vue';
import { defineStore } from 'pinia';
// 假設你已經載入露營地數據到此 store
import campgroundsData from '@/data/campgrounds.json'; // 假設你有這個數據文件

export const useCampgroundsStore = defineStore('campgrounds', () => {
  const campgrounds = ref(campgroundsData); // 你的露營地數據
  // 我的最愛列表，初始化時從 localStorage 載入
  const FAVORITE_KEY = 'favoriteCampgrounds';
  const favoriteCampgrounds = ref([]);
  // 載入 localStorage
  try {
    const saved = localStorage.getItem(FAVORITE_KEY);
    if (saved) favoriteCampgrounds.value = JSON.parse(saved);
  } catch (e) { favoriteCampgrounds.value = []; }
  const showCampgroundMarkers = ref(false); // 控制營地 Marker 顯示狀態

  // 加入我的最愛
  function addFavorite(campground) {
    if (!favoriteCampgrounds.value.some(fav => fav.id === campground.id)) {
      favoriteCampgrounds.value.push(campground);
      // 寫入 localStorage
      localStorage.setItem(FAVORITE_KEY, JSON.stringify(favoriteCampgrounds.value));
    }
  }

  // 移除我的最愛
  function removeFavorite(campgroundId) {
    favoriteCampgrounds.value = favoriteCampgrounds.value.filter(fav => fav.id !== campgroundId);
    // 寫入 localStorage
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(favoriteCampgrounds.value));
  }

  // 切換營地 Marker 顯示狀態
  function toggleCampgroundMarkers() {
    showCampgroundMarkers.value = !showCampgroundMarkers.value;
  }

  return {
    campgrounds,
    favoriteCampgrounds,
    showCampgroundMarkers,
    addFavorite,
    removeFavorite,
    toggleCampgroundMarkers
  };
});