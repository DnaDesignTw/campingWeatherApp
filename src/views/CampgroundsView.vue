<template>
  <div class="relative h-screen w-full overflow-hidden">
    <div id="mapContainer" class="h-full w-full z-0"></div>

    <div class="absolute top-4 right-4 z-10 flex flex-col space-y-2">
      <button @click="resetMapView" class="btn-icon" title="回到預設視圖">🏠</button>
      <button @click="openSearch" class="btn-icon" title="搜尋">🔍</button>
      <button @click="showFavoritesList" class="btn-icon" title="我的最愛">❤️</button>
      <button @click="campgroundsStore.toggleCampgroundMarkers" class="btn-icon" :class="{ 'bg-blue-200': campgroundsStore.showCampgroundMarkers }" title="顯示營地">⛺</button>
    </div>

    <div v-if="isSearchOpen" class="absolute top-4 right-20 z-10 bg-white p-4 rounded shadow-md">
      <input type="text" v-model="searchQuery" placeholder="搜尋縣市、鄉鎮或營地..." class="border p-2 rounded w-64" @keyup.enter="performSearch">
      <button @click="performSearch" class="ml-2 px-4 py-2 bg-blue-500 text-white rounded">搜尋</button>
      <button @click="isSearchOpen = false" class="ml-2 px-2 py-1 bg-gray-300 rounded">X</button>
    </div>

    <div v-if="isFavoritesListOpen" class="absolute top-4 left-4 z-10 bg-white p-4 rounded shadow-md w-80">
      <h2 class="text-xl font-bold mb-2">我的最愛營地</h2>
      <ul class="max-h-64 overflow-y-auto">
        <li v-for="camp in campgroundsStore.favoriteCampgrounds" :key="camp.id" class="flex justify-between items-center py-1 border-b last:border-b-0">
          {{ camp.name }}
          <button @click="campgroundsStore.removeFavorite(camp.id)" class="text-red-500 ml-2">移除</button>
        </li>
      </ul>
      <p v-if="campgroundsStore.favoriteCampgrounds.length === 0" class="text-gray-500">尚未加入任何最愛營地。</p>
      <button @click="isFavoritesListOpen = false" class="mt-4 px-4 py-2 bg-gray-300 rounded">關閉</button>
    </div>

    <div v-if="weatherStore.isLoadingWeather" class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black text-white px-4 py-2 rounded-full shadow-lg">
      載入資料中...
    </div>
  </div>

  <div id="popup-template" class="hidden"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // 引入 Leaflet 樣式
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
let campgroundMarkersLayer = L.featureGroup(); // 用於管理露營地 Marker 的圖層群組
let locationLabelsLayer = L.featureGroup(); // 用於管理縣市/鄉鎮標籤 Marker 的圖層群組

// 預設地圖視圖
const initialMapView = { center: [23.7, 121], zoom: 8 }; // 台灣中心點及初始縮放級別

// UI 狀態變數
const isSearchOpen = ref(false);
const searchQuery = ref('');
const isFavoritesListOpen = ref(false);

// UI 狀態切換函數
const openSearch = () => { isSearchOpen.value = !isSearchOpen.value; };
const showFavoritesList = () => { isFavoritesListOpen.value = !isFavoritesListOpen.value; };

// 搜尋功能 (待實作詳細邏輯)
const performSearch = () => {
  console.log('執行搜尋:', searchQuery.value);
  // TODO: 根據 searchQuery 過濾縣市/鄉鎮/營地，並導航到對應位置
  isSearchOpen.value = false; // 搜尋後關閉搜尋框
};

// --- 地圖初始化 ---
const initMap = async () => {
  if (map) {
    map.remove(); // 如果地圖已存在，先移除，防止重複初始化
  }

  // 創建地圖實例並設定初始視圖
  map = L.map('mapContainer').setView(initialMapView.center, initialMapView.zoom);

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
        weight: 1,
        opacity: 1,
        color: 'white', // 白色邊框
        dashArray: '3',
        fillOpacity: 0.7
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
          click: (e) => onLocationClick(countyName, countyCode, e.latlng, 'county', layer),
          mouseover: (e) => highlightFeature(e),
          mouseout: (e) => resetHighlight(e)
        });
      }
    }).addTo(map); // 將縣市 GeoJSON 圖層添加到地圖
  }

  // 5. 處理鄉鎮 GeoJSON：計算中心點 (不將其添加到地圖，只解析數據)
  if (townshipData) {
    L.geoJSON(townshipData, {
      onEachFeature: (feature, layer) => {
        const townshipName = feature.properties.TOWNNAME; // 假設鄉鎮名稱屬性
        const countyName = feature.properties.COUNTYNAME; // 假設所屬縣市名稱
        const townshipCode = feature.properties.TOWNCODE || townshipName; // 假設鄉鎮代碼

        const center = layer.getBounds().getCenter();
        processedLocationCoords[townshipName] = {
          lat: center.lat,
          lon: center.lon,
          type: 'township',
          name: townshipName,
          county: countyName, // 記錄所屬縣市
          code: townshipCode
        };
      }
    });
  }

  // 6. 將計算好的所有行政區中心點映射表更新到 Pinia Store
  weatherStore.setLocationCoordsMap(processedLocationCoords);

  // 7. 監聽地圖縮放和移動事件，動態更新縣市/鄉鎮標籤
  map.on('zoomend', updateLocationLabels);
  map.on('moveend', updateLocationLabels);

  // 8. 監聽營地 Marker 顯示狀態，並更新地圖上的 Marker
  watch(() => campgroundsStore.showCampgroundMarkers, (newValue) => {
    updateCampgroundMarkers(newValue);
  });

  // 9. 初始顯示地圖標籤 (縣市或鄉鎮)
  await updateLocationLabels();
};

// --- 更新地圖上的縣市/鄉鎮標籤 ---
async function updateLocationLabels() {
  const currentZoom = map.getZoom();
  locationLabelsLayer.clearLayers(); // 清除所有現有的標籤

  let locationsToDisplay = []; // 準備要在地圖上顯示名稱的列表

  // 根據縮放級別篩選要顯示的行政區類型 (縣市或鄉鎮)
  if (currentZoom >= 10) { // 當縮放級別大於或等於 10 時顯示鄉鎮標籤
    locationsToDisplay = Object.values(weatherStore.locationCoordsMap).filter(loc =>
      loc.type === 'township'
    );
  } else { // 否則顯示縣市標籤
    locationsToDisplay = Object.values(weatherStore.locationCoordsMap).filter(loc =>
      loc.type === 'county'
    );
  }

  // 進一步篩選：只顯示當前地圖視野內的地點，並準備查詢天氣
  const currentBounds = map.getBounds();
  const filteredLocationsForWeather = {};
  for (const loc of locationsToDisplay) {
    if (loc && currentBounds.contains([loc.lat, loc.lon])) {
      // 使用名稱作為 key 傳遞給天氣 API 查詢
      filteredLocationsForWeather[loc.name] = loc;
    }
  }

  // 批量獲取篩選後地點的當前天氣數據
  const weatherResults = await weatherStore.fetchMultipleLocationWeather(filteredLocationsForWeather);

  // 繪製地點標籤 (Marker with custom HTML icon)
  for (const name in filteredLocationsForWeather) {
    const loc = filteredLocationsForWeather[name];
    const weather = weatherResults[name]; // 從天氣結果中獲取該地點的天氣數據

    // 構建 HTML 標籤內容 (包含名稱、天氣圖標、溫度)
    const labelContent = `
      <div class="bg-white p-1 rounded-md shadow-sm text-sm whitespace-nowrap flex items-center" style="pointer-events: auto; cursor: pointer;">
        <span class="font-bold">${loc.name}</span>
        <span class="ml-1">${weather ? weather.icon : '❓'}</span>
        <span class="ml-1">${weather ? weather.temp : 'N/A'}°C</span>
      </div>
    `;

    // 創建自定義的 DivIcon (HTML 圖標)
    const customIcon = L.divIcon({
      className: 'custom-div-icon', // 可以在 CSS 中定義樣式
      html: labelContent,
      iconAnchor: [0, 0] // 圖標錨點 (左上角)
    });

    // 創建 Marker 並添加到 locationLabelsLayer
    const marker = L.marker([loc.lat, loc.lon], { icon: customIcon });
    marker.on('click', (e) => onLocationClick(loc.name, loc.code, e.latlng, loc.type, null)); // 點擊標籤也觸發 onLocationClick
    locationLabelsLayer.addLayer(marker);
  }
}

// --- 點擊行政區/露營地 Marker 事件處理 ---
async function onLocationClick(name, code, latlng, type, layer) {
  console.log(`點擊了 ${type}:`, name, `代碼/ID: ${code}`);

  // 1. 獲取並顯示該地點的一週天氣預報
  await weatherStore.fetchOneWeekForecast(latlng.lat, latlng.lng);

  // 2. 顯示 Leaflet Popup
  const popupContent = generatePopupContent(name, latlng, type, code); // 傳遞 code 以便識別營地
  const popup = L.popup({ minWidth: 250, maxWidth: 300 })
    .setLatLng(latlng)
    .setContent(popupContent)
    .openOn(map);

  // 3. Popup 開啟後，為「加入我的最愛」按鈕綁定事件
  popup.on('popupopen', () => {
    const addToFavoriteBtn = document.getElementById('add-to-favorite-btn');
    if (addToFavoriteBtn) {
      addToFavoriteBtn.onclick = () => {
        if (type === 'campground') {
          // 在 campgroundsStore 中查找該營地資訊
          const camp = campgroundsStore.campgrounds.find(c => c.id === code);
          if (camp) {
            campgroundsStore.addFavorite(camp);
            alert(`${camp.name} 已加入我的最愛！`);
          }
        } else {
          // 如果點擊的是縣市或鄉鎮，但還沒有收藏行政區的功能
          alert(`${name} (${type === 'county' ? '縣市' : '鄉鎮'}) 暫時無法直接收藏，請點擊營地！`);
        }
        popup.close(); // 點擊後關閉 Popup
      };
    }
  });

  // 4. 如果是點擊 GeoJSON 多邊形，則縮放地圖到該區域邊界
  if (layer && type !== 'campground') {
    map.fitBounds(layer.getBounds(), { padding: [50, 50] }); // 增加 padding 讓邊界更清晰
  } else {
    // 如果是 Marker 或標籤點擊，稍微平移地圖確保 Popup 可見
    map.flyTo(latlng, Math.max(map.getZoom(), 12)); // 如果縮放級別過小，至少放大到 12
  }
}

// --- 根據 Store 中的數據生成 Popup 內容 ---
function generatePopupContent(name, latlng, type, id) {
  const forecast = weatherStore.selectedLocationForecast;
  let forecastHtml = '';
  if (forecast && forecast.time && forecast.temperature_2m_max && forecast.temperature_2m_min && forecast.weather_code) {
    for (let i = 0; i < forecast.time.length; i++) {
      const date = new Date(forecast.time[i]);
      const day = date.toLocaleDateString('zh-TW', { weekday: 'short', month: 'numeric', day: 'numeric' });
      const maxTemp = Math.round(forecast.temperature_2m_max[i]);
      const minTemp = Math.round(forecast.temperature_2m_min[i]);
      const weatherIcon = weatherStore.getIconForWeatherCode(forecast.weather_code[i]);
      forecastHtml += `
        <div class="flex justify-between items-center text-sm py-1 border-b last:border-b-0">
          <span>${day}</span>
          <span>${weatherIcon}</span>
          <span>${minTemp}°C / ${maxTemp}°C</span>
        </div>
      `;
    }
  } else if (weatherStore.isLoadingWeather) {
    forecastHtml = '<p>載入預報中...</p>';
  } else {
    forecastHtml = '<p class="text-red-500">無法取得預報資料。</p>';
  }

  // 根據類型決定「加入我的最愛」按鈕的顯示狀態
  const favoriteButtonHtml = type === 'campground' ?
    `<div class="mt-4 text-center">
       <button id="add-to-favorite-btn" class="text-red-500 text-2xl hover:scale-110 transition-transform" title="加入我的最愛">❤️</button>
     </div>` : ''; // 非營地不顯示收藏按鈕

  return `
    <h3 class="font-bold text-lg mb-2">${name}</h3>
    <div class="text-sm text-gray-700 mb-2">一週天氣預報</div>
    <div id="popup-forecast-daily" class="max-h-40 overflow-y-auto">${forecastHtml}</div>
    ${favoriteButtonHtml}
  `;
}

// --- 營地 Marker 相關功能 ---
function updateCampgroundMarkers(show) {
  campgroundMarkersLayer.clearLayers(); // 清除現有所有營地 Marker
  if (show) {
    const visibleCampgrounds = campgroundsStore.campgrounds.filter(camp => {
        // 可以增加篩選條件，例如只顯示視野內的營地
        return map.getBounds().contains([camp.latitude, camp.longitude]);
    });

    visibleCampgrounds.forEach(camp => {
      if (camp.latitude && camp.longitude) {
        const marker = L.marker([camp.latitude, camp.longitude], {
          // 可以自定義營地 Marker 圖標
          // icon: L.icon({
          //   iconUrl: '/icons/camp-icon.png', // 你需要準備這個圖標
          //   iconSize: [32, 32],
          //   iconAnchor: [16, 32]
          // })
        });
        marker.on('click', (e) => onLocationClick(camp.name, camp.id, e.latlng, 'campground', null));
        marker.bindTooltip(camp.name, {permanent: false, direction: 'top'}); // 滑鼠移入顯示名稱
        campgroundMarkersLayer.addLayer(marker);
      }
    });

    // 如果顯示營地，且有營地在範圍內，嘗試縮放至所有可見營地
    if (visibleCampgrounds.length > 0) {
        const bounds = L.latLngBounds(visibleCampgrounds.map(c => [c.latitude, c.longitude]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 }); // 限制最大縮放級別
    }
  }
}

// --- 地圖基本互動 ---
const resetMapView = () => {
  map.setView(initialMapView.center, initialMapView.zoom);
};

// --- GeoJSON 縣市邊界互動樣式 ---
const highlightFeature = (e) => {
  const layer = e.target;
  layer.setStyle({
    weight: 3,
    color: '#666',
    dashArray: '',
    fillOpacity: 0.9
  });
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront(); // 將當前懸停的縣市邊界置於頂層
  }
};

const resetHighlight = (e) => {
  if (countyGeoJsonLayer) {
    countyGeoJsonLayer.resetStyle(e.target); // 恢復 GeoJSON 圖層的預設樣式
  }
};

// --- Vue 組件生命週期 ---
onMounted(() => {
  initMap(); // 組件掛載後初始化地圖
});

onBeforeUnmount(() => {
  if (map) {
    map.remove(); // 組件卸載前清除地圖實例，防止記憶體洩漏
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

/* 自定義 DivIcon 的樣式，讓它能被點擊 (使用 :deep() 穿透到 Leaflet 生成的 DOM) */
:deep(.custom-div-icon) {
  pointer-events: auto; /* 確保 div 可以被點擊 */
  cursor: pointer;
}

/* 可以為 Popup 添加一些自定義樣式 */
:deep(.leaflet-popup-content-wrapper) {
  border-radius: 8px;
  padding: 10px;
}
:deep(.leaflet-popup-content) {
  margin: 0;
}
</style>