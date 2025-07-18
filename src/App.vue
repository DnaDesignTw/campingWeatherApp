<template>
  <div class="relative h-screen w-full overflow-hidden">
    <div id="mapContainer" class="h-full w-full z-0"></div>

    <div class="absolute top-4 right-4 z-10 flex flex-col space-y-2">
      <button @click="resetMapView" class="btn-icon" title="回到預設視圖">🏠</button>
      <button @click="openSearch" class="btn-icon" title="搜尋">🔍</button>
      <button @click="showFavoritesList" class="btn-icon" title="我的最愛">❤️</button>
      <button @click="campgroundsStore.toggleCampgroundMarkers" class="btn-icon" :class="{ 'bg-blue-200': campgroundsStore.showCampgroundMarkers }" title="營地">⛺</button>
    </div>

    <div v-if="isSearchOpen" class="absolute top-4 right-20 z-10 bg-white p-4 rounded shadow-md">
      <input type="text" v-model="searchQuery" placeholder="搜尋縣市、鄉鎮或營地..." class="border p-2 rounded w-64" @keyup.enter="performSearch">
      <button @click="performSearch" class="ml-2 px-4 py-2 bg-blue-500 text-white rounded">搜尋</button>
      <button @click="isSearchOpen = false" class="ml-2 px-2 py-1 bg-gray-300 rounded">X</button>
      <div v-if="searchQuery && searchResults.length === 0" class="mt-2 text-gray-500">查無符合結果</div>
      <ul v-if="searchResults.length > 0" class="mt-2 max-h-64 overflow-y-auto border rounded bg-white shadow">
        <li v-for="item in searchResults" :key="item.type + '-' + item.name + '-' + (item.id || '')" class="px-2 py-1 hover:bg-blue-100 cursor-pointer flex items-center"
            @click="() => { performSearchByItem(item); }">
          <span class="font-bold mr-2">{{ item.name }}</span>
          <span v-if="item.type === 'county'" class="text-xs text-gray-600">縣市</span>
          <span v-else-if="item.type === 'township'" class="text-xs text-gray-600">鄉鎮</span>
          <span v-else class="text-xs text-green-600">營地</span>
        </li>
      </ul>
    </div>

    <div v-if="isFavoritesListOpen" class="absolute top-4 left-4 z-10 bg-white p-4 rounded shadow-md w-[480px]">
      <h2 class="text-xl font-bold mb-4">我的最愛營地</h2>
      <div class="flex flex-wrap gap-4 max-h-96 overflow-y-auto">
        <div v-for="camp in campgroundsStore.favoriteCampgrounds" :key="camp.id" class="favorite-card bg-blue-50 rounded-lg shadow p-4 flex flex-col">
          <div class="flex justify-between items-center mb-2">
            <span class="font-semibold text-base">{{ camp.name }}</span>
            <button @click="campgroundsStore.removeFavorite(camp.id)" class="text-red-500 ml-2 text-sm">移除</button>
          </div>
          <div v-if="weatherStore.favoriteCampgroundWeather[camp.id] && Object.keys(weatherStore.favoriteCampgroundWeather[camp.id].weather || {}).length > 0">
            <div class="favorite-week-scroll">
              <div v-for="(hours, day) in weatherStore.favoriteCampgroundWeather[camp.id].weather" :key="day" class="favorite-week-card bg-white rounded-lg shadow-sm px-3 py-3 mr-3 flex flex-col items-center min-w-[120px]">
                <span class="font-bold text-blue-700 mb-1">{{ day }}</span>
                <span class="text-3xl mb-1">{{ hours[0].icon }}</span>
                <span class="text-base mb-1">
                  <span class="text-red-600">{{ Math.max(...hours.map(h => h.temp)) }}°C</span> / <span class="text-blue-600">{{ Math.min(...hours.map(h => h.temp)) }}°C</span>
                </span>
                <span class="text-blue-500 text-xs mb-1">{{ hours.reduce((sum, h) => sum + h.rain, 0).toFixed(1) }} mm</span>
              </div>
            </div>
          </div>
          <div v-else class="text-xs text-gray-400 mt-2">載入天氣中...</div>
        </div>
      </div>
      <p v-if="campgroundsStore.favoriteCampgrounds.length === 0" class="text-gray-500 mt-2">尚未加入任何最愛營地。</p>
      <button @click="isFavoritesListOpen = false" class="mt-4 px-4 py-2 bg-gray-300 rounded">關閉</button>
    </div>

    <div v-if="weatherStore.isLoadingWeather" class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black text-white px-4 py-2 rounded-full shadow-lg">
      載入資料中...
    </div>
  </div>
  <button
    v-if="showLoadMore && campgroundsStore.showCampgroundMarkers"
    @click="loadAllMarkers"
    class="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white px-6 py-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
  >
    載入更多營地
  </button>
  <div id="popup-template" class="hidden"></div>

  <!-- 底部滿版 Popup -->
  <transition name="slide-fade">
    <div v-if="isBottomPopupOpen" class="fixed inset-0 z-30 flex items-end justify-center p-4 pointer-events-none">
      <div class="w-full max-w-md p-6 bg-white rounded-t-lg shadow-lg pointer-events-auto">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-bold">地點資訊</h3>
          <button @click="closeBottomPopup" class="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="mt-4" v-html="bottomPopupContent"></div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // 引入 Leaflet 樣式
import '@fortawesome/fontawesome-free/css/all.min.css'; // 引入 Font Awesome 樣式
import { useWeatherStore } from '@/stores/weather';
import { useCampgroundsStore } from '@/stores/campgrounds';

// 修正 Leaflet 預設圖標路徑問題 (避免 Marker 顯示為藍色方塊)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// 引入 Pinia Store
const weatherStore = useWeatherStore();
const campgroundsStore = useCampgroundsStore();

// 地圖相關變數
let map = null; // Leaflet 地圖實例
let countyGeoJsonLayer = null; // 儲存縣市 GeoJSON 圖層實例 (用於樣式重置)
let townshipGeoJsonLayer = null; // 新增：儲存鄉鎮 GeoJSON 圖層實例
let campgroundMarkersLayer = L.featureGroup(); // 用於管理露營地 Marker 的圖層群組
let locationLabelsLayer = L.featureGroup(); // 用於管理縣市/鄉鎮標籤 Marker 的圖層群組

// 預設地圖視圖
const initialMapView = { center: [24.76, 121.43], zoom: 10 }; // 台灣中心點及初始縮放級別

// UI 狀態變數
const isSearchOpen = ref(false);
const searchQuery = ref('');
const isFavoritesListOpen = ref(false);
const isBottomPopupOpen = ref(false);
const bottomPopupContent = ref('');

// UI 狀態切換函數
const openSearch = () => { isSearchOpen.value = !isSearchOpen.value; };
const showFavoritesList = () => { isFavoritesListOpen.value = !isFavoritesListOpen.value; };

// 我的最愛天氣快取與自動查詢
import { nextTick } from 'vue';
watch(isFavoritesListOpen, async (open) => {
  if (open) {
    await nextTick();
    await weatherStore.fetchFavoriteCampgroundsWeather(campgroundsStore.favoriteCampgrounds);
  }
});

// 即時搜尋結果
const searchResults = ref([]);

watch(searchQuery, (newQuery) => {
  if (!newQuery) {
    searchResults.value = [];
    return;
  }
  const keyword = newQuery.trim();
  if (!keyword) {
    searchResults.value = [];
    return;
  }
  // 搜尋縣市、鄉鎮、營地
  const counties = Object.values(weatherStore.locationCoordsMap).filter(loc => loc.type === 'county' && loc.name.includes(keyword));
  const townships = Object.values(weatherStore.locationCoordsMap).filter(loc => loc.type === 'township' && loc.name.includes(keyword));
  const campgrounds = campgroundsStore.campgrounds.filter(camp => camp.name && camp.name.includes(keyword));
  searchResults.value = [
    ...counties.map(loc => ({ type: 'county', name: loc.name, lat: loc.lat, lon: loc.lon })),
    ...townships.map(loc => ({ type: 'township', name: loc.name, lat: loc.lat, lon: loc.lon })),
    ...campgrounds.map(camp => ({ type: 'campground', name: camp.name, lat: camp.latitude, lon: camp.longitude, id: camp.id }))
  ];
});

// 搜尋功能 (即時顯示結果，按下搜尋則導航到第一個結果)
const performSearch = () => {
  if (searchResults.value.length > 0) {
    const first = searchResults.value[0];
    if (first.type === 'campground') {
      map.setView([first.lat, first.lon], 15);
      onLocationClick(first.name, first.id, { lat: first.lat, lng: first.lon }, 'campground', null);
    } else {
      map.setView([first.lat, first.lon], 12);
      onLocationClick(first.name, first.name, { lat: first.lat, lng: first.lon }, first.type, null);
    }
    isSearchOpen.value = false;
  }
};

// 新增：搜尋結果點擊導航
function performSearchByItem(item) {
  if (item.type === 'campground') {
    map.setView([item.lat, item.lon], 15);
    onLocationClick(item.name, item.id, { lat: item.lat, lng: item.lon }, 'campground', null);
  } else {
    map.setView([item.lat, item.lon], 12);
    onLocationClick(item.name, item.name, { lat: item.lat, lng: item.lon }, item.type, null);
  }
  isSearchOpen.value = false;
}

const markerLimit = ref(50); // 初始顯示 50 筆
const showLoadMore = ref(false); // 是否顯示載入更多按鈕

function loadAllMarkers() {
  markerLimit.value = Infinity;
  showLoadMore.value = false;
  updateCampgroundMarkers(true);
}

// --- 地圖初始化 ---
const initMap = async () => {
  if (map) {
    map.remove(); // 如果地圖已存在，先移除，防止重複初始化
  }

  // 創建地圖實例並設定初始視圖
  map = L.map('mapContainer').setView(initialMapView.center, initialMapView.zoom);

  // 顯示定位按鈕，讓使用者自行選擇是否定位
  const locateBtn = L.control({ position: 'topleft' });
  locateBtn.onAdd = function () {
    const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
    btn.innerHTML = '📍 我的定位';
    btn.style.backgroundColor = 'white';
    btn.style.width = '90px';
    btn.style.height = '32px';
    btn.style.cursor = 'pointer';
    btn.onclick = function (e) {
      e.stopPropagation();
      map.locate({ setView: true, maxZoom: 12, enableHighAccuracy: true });
    };
    return btn;
  };
  locateBtn.addTo(map);

  map.on('locationfound', (e) => {
    // userLocated = true; // 這裡沒有定義 userLocated，如果需要，請在外面宣告
    L.marker(e.latlng).addTo(map).bindPopup('您目前的位置').openPopup();
  });
  map.on('locationerror', (e) => {
    console.warn('定位失敗:', e.message);
  });

  // 添加 OpenStreetMap 基礎圖層
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // 將營地 Marker 和位置標籤圖層群組加入地圖
  campgroundMarkersLayer.addTo(map);
  locationLabelsLayer.addTo(map);

  // 1. 載入原始 GeoJSON 數據到 Pinia Store
  await weatherStore.loadTaiwanGeoJsonData();

  // 2. 從 Store 取得原始 GeoJSON 數據
  const countyData = weatherStore.taiwanCountyGeoJson;
  const townshipData = weatherStore.taiwanTownshipGeoJson;

  // 3. 準備一個物件來儲存所有行政區的中心點經緯度映射
  const processedLocationCoords = {};

  // 4. 處理縣市 GeoJSON：計算中心點並綁定事件
  if (countyData) {
    countyGeoJsonLayer = L.geoJSON(countyData, {
      style: (feature) => ({ // 縣市邊界預設樣式
        fillColor: '#ADD8E6', // 淺藍色填充
        weight: 0,
        opacity: 0,
        color: 'white', // 白色邊框
        dashArray: '3',
        fillOpacity: 0.6
      }),
      onEachFeature: (feature, layer) => {
        const countyName = feature.properties.COUNTYNAME; // 假設 GeoJSON 中縣市名稱屬性為 COUNTYNAME
        const countyCode = feature.properties.COUNTYCODE || countyName; // 假設縣市代碼為 COUNTYCODE

        // 計算該縣市多邊形的中心點 (用於天氣查詢和標籤)
        const center = layer.getBounds().getCenter();
        processedLocationCoords[countyName] = {
          lat: center.lat,
          lon: center.lng,
          type: 'county',
          name: countyName, // 確保名稱也在物件中
          code: countyCode
        };

        // 綁定點擊、滑鼠移入/移出事件到 GeoJSON 圖層
        layer.on({
          click: (e) => onLocationClick(countyName, countyCode, e.latlng, 'county', layer)
        });
      }
    }); // 不加 .addTo(map) 這裡，由 updateBoundaryLayers 管理
  }

  // 5. 處理鄉鎮 GeoJSON：計算中心點並建立圖層 (不立即添加到地圖)
  if (townshipData) {
    townshipGeoJsonLayer = L.geoJSON(townshipData, { // Assign to the new layer variable
      style: (feature) => ({ // 鄉鎮邊界預設樣式
        fillColor: '#ADD8E6', // 淺藍色填充
        weight: 1,
        opacity: 0.8,
        color: 'gray', // 白色邊框
        dashArray: '5',
        fillOpacity: 0.6
      }),
      onEachFeature: (feature, layer) => {
        const townshipName = feature.properties.TOWNNAME; // 假設鄉鎮名稱屬性
        const countyName = feature.properties.COUNTYNAME; // 假設所屬縣市名稱
        const townshipCode = feature.properties.TOWNCODE || townshipName; // 假設鄉鎮代碼

        const center = layer.getBounds().getCenter();
        processedLocationCoords[townshipName] = {
          lat: center.lat,
          lon: center.lng, 
          type: 'township',
          name: townshipName,
          county: countyName,
          code: townshipCode
        };

        // 綁定點擊事件到鄉鎮 GeoJSON 圖層
        layer.on({
          click: (e) => onLocationClick(townshipName, townshipCode, e.latlng, 'township', layer)
        });
      }
    }); // 不加 .addTo(map) 這裡，由 updateBoundaryLayers 管理
  }

  // 6. 將計算好的所有行政區中心點映射表更新到 Pinia Store
  weatherStore.setLocationCoordsMap(processedLocationCoords);

  // 7. 監聽地圖縮放和移動事件，動態更新縣市/鄉鎮標籤和邊界
  map.on('zoomend', () => {
    updateLocationLabels(); // 更新標籤
    updateBoundaryLayers(); // 更新邊界圖層
  });
  map.on('moveend', updateLocationLabels); // 只更新標籤，邊界圖層只在縮放時改變

  // 8. 監聽營地 Marker 顯示狀態，並更新地圖上的 Marker
  watch(() => campgroundsStore.showCampgroundMarkers, (newValue) => {
    markerLimit.value = 50;
    updateCampgroundMarkers(newValue);
  });
  map.on('moveend', () => {
    if (campgroundsStore.showCampgroundMarkers) {
      markerLimit.value = 50;
      updateCampgroundMarkers(true);
    }
  });
  map.on('zoomend', () => {
    if (campgroundsStore.showCampgroundMarkers) {
      markerLimit.value = 50;
      updateCampgroundMarkers(true);
    }
  });

  // 9. 初始顯示地圖標籤和邊界 (縣市或鄉鎮)
  await updateLocationLabels();
  await updateBoundaryLayers(); // Call this initially
};

// --- 更新地圖上的縣市/鄉鎮邊界圖層 ---
async function updateBoundaryLayers() {
  const currentZoom = map.getZoom();

  if (currentZoom >= 13) {
    // 移除所有行政區邊界圖層
    if (countyGeoJsonLayer && map.hasLayer(countyGeoJsonLayer)) {
      map.removeLayer(countyGeoJsonLayer);
    }
    if (townshipGeoJsonLayer && map.hasLayer(townshipGeoJsonLayer)) {
      map.removeLayer(townshipGeoJsonLayer);
    }
  } else if (currentZoom >= 12) {
    // 顯示鄉鎮邊界
    if (countyGeoJsonLayer && map.hasLayer(countyGeoJsonLayer)) {
      map.removeLayer(countyGeoJsonLayer); // 移除縣市圖層
    }
    if (townshipGeoJsonLayer && !map.hasLayer(townshipGeoJsonLayer)) {
      map.addLayer(townshipGeoJsonLayer); // 添加鄉鎮圖層
    }
  } else {
    // 顯示縣市邊界
    if (townshipGeoJsonLayer && map.hasLayer(townshipGeoJsonLayer)) {
      map.removeLayer(townshipGeoJsonLayer); // 移除鄉鎮圖層
    }
    if (countyGeoJsonLayer && !map.hasLayer(countyGeoJsonLayer)) {
      map.addLayer(countyGeoJsonLayer); // 添加縣市圖層
    }
  }
}


// --- 更新地圖上的縣市/鄉鎮標籤 (此函式邏輯不變，因為它已經根據 zoom 篩選了 loc.type) ---
async function updateLocationLabels() {
  const currentZoom = map.getZoom();
  console.log('目前地圖縮放層級：', currentZoom);
  locationLabelsLayer.clearLayers(); // 清除所有現有的標籤

  let locationsToDisplay = [];
  // 根據縮放級別篩選要顯示的行政區類型 (縣市或鄉鎮)
  if (currentZoom >= 13) {
    //當縮放層級大於等於 13 時，不顯示任何行政區標籤
    locationsToDisplay = [];
  }else if (currentZoom >= 12) {
    locationsToDisplay = Object.values(weatherStore.locationCoordsMap).filter(loc => loc.type === 'township');
  } else {
    locationsToDisplay = Object.values(weatherStore.locationCoordsMap).filter(loc => loc.type === 'county');
  }

  // 進一步篩選：只顯示當前地圖視野內的地點，並準備查詢天氣
  const currentBounds = map.getBounds();
  const filteredLocationsForWeather = {};
  for (const loc of locationsToDisplay) {
    // 檢查經緯度有效性
    if (
      loc &&
      typeof loc.lat === 'number' &&
      typeof loc.lon === 'number' &&
      isFinite(loc.lat) &&
      isFinite(loc.lon) &&
      currentBounds.contains([loc.lat, loc.lon])
    ) {
      filteredLocationsForWeather[loc.name] = loc;
    }
  }

  // 批量獲取篩選後地點的當前天氣數據
  const weatherResults = await weatherStore.fetchMultipleLocationWeather(filteredLocationsForWeather);

  // 繪製地點標籤 (Marker with custom HTML icon)
  for (const name in filteredLocationsForWeather) {
    const loc = filteredLocationsForWeather[name];
    const weather = weatherResults[name];
    const labelContent = `
      <div class="p-1 rounded-md text-sm whitespace-nowrap flex items-center" style="pointer-events: auto; cursor: pointer;">
        <span class="font-bold">${loc.name}</span>
        <span class="ml-1">${weather ? weather.icon : '❓'}</span>
        <span class="ml-1">${weather ? weather.temp : 'N/A'}°C</span>
      </div>
    `;
    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: labelContent,
      iconAnchor: [0, 0]
    });
    const marker = L.marker([loc.lat, loc.lon], { icon: customIcon });
    marker.on('click', (e) => onLocationClick(loc.name, loc.code, e.latlng, loc.type, null));
    locationLabelsLayer.addLayer(marker);
  }
}

// --- 點擊行政區/露營地 Marker 事件處理 ---
async function onLocationClick(name, code, latlng, type, layer) {
  console.log(`點擊了 ${type}:`, name, `代碼/ID: ${code}`);

  // 1. 獲取並顯示該地點的一週天氣預報
  await weatherStore.fetchHourlyForecast(latlng.lat, latlng.lng);


  // 2. 顯示 Leaflet Popup
  const popupContent = generatePopupContent(name, latlng, type, code);
  const popup = L.popup({ minWidth: 250, maxWidth: 300, offset: [0, -30] })
    .setLatLng(latlng)
    .setContent(popupContent)
    .openOn(map);

  // 3. Popup 開啟後，為「加入我的最愛」按鈕綁定事件（直接 setTimeout，確保 DOM 已插入）
  setTimeout(() => {
    const addToFavoriteBtn = document.getElementById('add-to-favorite-btn');
    if (addToFavoriteBtn) {
      addToFavoriteBtn.onclick = () => {
        if (type === 'campground') {
          const camp = campgroundsStore.campgrounds.find(c => String(c.id) === String(code));
          if (camp) {
            campgroundsStore.addFavorite(camp);
            alert(`${camp.name} 已加入我的最愛！`);
          }
        } else {
          alert(`${name} (${type === 'county' ? '縣市' : '鄉鎮'}) 暫時無法直接收藏，請點擊營地！`);
        }
        popup.close();
      };
    }
  }, 100);

  // 4. 只針對區域（多邊形）點擊才平移地圖，marker 點擊不平移
  if (layer && type !== 'campground') {
    const center = layer.getBounds().getCenter();
    map.panTo(center, { animate: true });
  }
}

// --- 根據 Store 中的數據生成 Popup 內容 ---
function generatePopupContent(name, latlng, type, id) {
  const forecast = weatherStore.selectedLocationForecast;
  let forecastHtml = '';
  // 預期 forecast 結構: { time: [...], temperature_2m: [...], precipitation: [...], weather_code: [...] }
  if (forecast && forecast.time && forecast.temperature_2m && forecast.precipitation && forecast.weather_code) {
    // 將每小時資料分組為 7 天
    const days = {};
    for (let i = 0; i < forecast.time.length; i++) {
      const dateObj = new Date(forecast.time[i]);
      const dayKey = dateObj.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' });
      if (!days[dayKey]) days[dayKey] = [];
      days[dayKey].push({
        hour: dateObj.getHours(),
        temp: Math.round(forecast.temperature_2m[i]),
        rain: forecast.precipitation[i],
        icon: weatherStore.getIconForWeatherCode(forecast.weather_code[i])
      });
    }
    // 橫向捲動卡片，每天一組
    forecastHtml = Object.entries(days).map(([day, hours]) => `
      <div class="mb-2">
        <div class="font-bold text-blue-700 mb-1">${day}</div>
        <div class="windy-scroll-wrapper flex overflow-x-auto pb-2">
          ${hours.map(h => `
            <div class="windy-hour-card min-w-[90px] bg-blue-50 rounded p-2 mx-1 flex flex-col items-center">
              <div class="text-xs text-gray-500">${h.hour}:00</div>
              <div class="text-2xl">${h.icon}</div>
              <div class="font-bold text-lg">${h.temp}°C</div>
              <div class="text-xs text-blue-600">${h.rain} mm</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  } else if (weatherStore.isLoadingWeather) {
    forecastHtml = '<p>載入預報中...</p>';
  } else {
    forecastHtml = '<p class="text-red-500">無法取得預報資料。</p>';
  }

  // 根據類型決定「加入我的最愛」按鈕的顯示狀態
  const favoriteButtonHtml = type === 'campground' ?
    `<div class="mt-4 text-center">
        <button id="add-to-favorite-btn" class="text-red-500 text-2xl hover:scale-110 transition-transform" title="加入我的最愛">❤️</button>
      </div>` : '';

  return `
    <h3 class="font-bold text-lg mb-2">${name}</h3>
    <div class="text-sm text-gray-700 mb-2">每小時預報（含降雨量）</div>
    <div id="popup-forecast-hourly">${forecastHtml}</div>
    ${favoriteButtonHtml}
  `;
}

// --- 營地 Marker 相關功能 ---
function updateCampgroundMarkers(show) {
  campgroundMarkersLayer.clearLayers();
  if (show) {
    const zoom = map.getZoom();
    let visibleCampgrounds = [];
    if (zoom >= 13) {
      // zoom >= 13 顯示視野內全部
      visibleCampgrounds = campgroundsStore.campgrounds.filter(camp =>
        map.getBounds().contains([camp.latitude, camp.longitude])
      );
    } else {
      // 依鄉鎮分組，視野內每個鄉鎮只取前 5 個營地
      const visibleCampsByTown = {};
      campgroundsStore.campgrounds.forEach(camp => {
        if (!map.getBounds().contains([camp.latitude, camp.longitude])) return;
        const town = camp.town || camp.township || camp.townName || camp.town_name || '未知鄉鎮';
        if (!visibleCampsByTown[town]) visibleCampsByTown[town] = [];
        if (visibleCampsByTown[town].length < 5) {
          visibleCampsByTown[town].push(camp);
          visibleCampgrounds.push(camp);
        }
      });
      visibleCampgrounds = Object.values(visibleCampsByTown).flat();
    }
    showLoadMore.value = false;

    visibleCampgrounds.forEach(camp => {
      if (camp.latitude && camp.longitude) {
        const campIcon = L.divIcon({
          className: 'gmap-marker',
          html: '<span class="gmap-marker-bg"><i class="fa-solid fa-campground"></i></span>',
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        });
        const marker = L.marker([camp.latitude, camp.longitude], { icon: campIcon });
        marker.on('click', (e) => onLocationClick(camp.name, camp.id, e.latlng, 'campground', null));
        marker.bindTooltip(camp.name, { permanent: false, direction: 'top' });
        campgroundMarkersLayer.addLayer(marker);
      }
    });
  }
}

// --- 地圖基本互動 ---
const resetMapView = () => {
  map.setView(initialMapView.center, initialMapView.zoom);
};

// 初始化地圖
onMounted(() => {
  initMap();
});

// 組件卸載前清理
onBeforeUnmount(() => {
  if (map) {
    map.off();
    map.remove();
    map = null;
  }
});
</script>

<style scoped>
/* 確保地圖容器有明確的高度和寬度 */
#mapContainer {
  height: 100vh;
  width: 100vw;
}

/* 樣式化功能按鈕 */
@reference "tailwindcss";
.btn-icon {
  @apply bg-white p-3 rounded-full shadow-md text-xl cursor-pointer hover:bg-gray-100 transition-colors;
}

/* 我的最愛卡片式樣式 */
.favorite-card {
  width: 100%;
  transition: box-shadow 0.2s, transform 0.2s;
}

/* 一週天氣橫向排列卡片 */
.favorite-week-scroll {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 4px;
}
.favorite-week-card {
  min-width: 120px;
  max-width: 120px;
  background: #f8fbff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,64,0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 自定義 DivIcon 的樣式，讓它能被點擊 (使用 :deep() 穿透到 Leaflet 生成的 DOM) */
:deep(.custom-div-icon),
:deep(.fa-marker-icon) {
  pointer-events: auto; /* 確保 div 可以被點擊 */
  cursor: pointer;
  background: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  }


/* 可以為 Popup 添加一些自定義樣式 */
:deep(.leaflet-popup-content-wrapper) {
  border-radius: 8px;
  padding: 10px;
}
:deep(.leaflet-popup-content) {
  margin: 0;
}

/* 滑動淡入過渡效果 */
.slide-fade-enter-active, .slide-fade-leave-active {
  transition: opacity 0.5s, transform 0.5s;
}
.slide-fade-enter, .slide-fade-leave-to /* .slide-fade-leave-active 在舊版 Vue 中使用 */ {
  opacity: 0;
  transform: translateY(10px);
}

/* 底部滿版 Popup 樣式 */
.windy-bottom-popup {
  @apply fixed inset-0 z-30 flex items-end justify-center p-4 pointer-events-none;
}
.windy-bottom-popup-inner {
  @apply w-full max-w-md p-6 bg-white rounded-t-lg shadow-lg pointer-events-auto;
}
.windy-bottom-popup-close {
  @apply text-gray-500 hover:text-gray-700;
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.25rem;
}
</style>