<template>
  <div class="relative h-screen w-full overflow-hidden">
    <div id="mapContainer" class="h-full w-full z-0"></div>

    <div class="absolute top-4 right-4 z-10 flex flex-col space-y-2">
      <button @click="resetMapView" class="btn-icon" title="回到預設視圖">🏠</button>
      <button @click="openSearch" class="btn-icon" title="搜尋">🔍</button>
      <button @click="showFavoritesList" class="btn-icon text-red-500" title="我的最愛">
        <i class="fa-solid fa-heart"></i>
      </button>
      <button
        @click="campgroundsStore.toggleCampgroundMarkers"
        class="btn-icon"
        :class="{ 'bg-blue-200': campgroundsStore.showCampgroundMarkers }"
        title="營地"
      >
        ⛺
      </button>
    </div>

    <div v-if="isSearchOpen" class="absolute top-4 right-20 z-10 bg-white p-4 rounded shadow-md">
      <input
        type="text"
        v-model="searchQuery"
        placeholder="搜尋縣市、鄉鎮或營地..."
        class="border p-2 rounded w-64 mb-2 md:mb-0"
        @keyup.enter="performSearch"
      />
      <button @click="performSearch" class="ml-2 px-4 py-2 bg-blue-500 text-white rounded">
        搜尋
      </button>
      <button @click="isSearchOpen = false" class="ml-2 px-2 py-1 bg-gray-300 rounded">X</button>
      <div v-if="searchQuery && searchResults.length === 0" class="mt-2 text-gray-500">
        查無符合結果
      </div>
      <ul
        v-if="searchResults.length > 0"
        class="mt-2 max-h-64 overflow-y-auto border rounded bg-white shadow"
      >
        <li
          v-for="item in searchResults"
          :key="item.type + '-' + item.name + '-' + (item.id || '')"
          class="px-2 py-1 hover:bg-blue-100 cursor-pointer flex items-center"
          @click="
            () => {
              performSearchByItem(item)
            }
          "
        >
          <span class="font-bold mr-2">{{ item.name }}</span>
          <span v-if="item.type === 'county'" class="text-xs text-gray-600">縣市</span>
          <span v-else-if="item.type === 'township'" class="text-xs text-gray-600">鄉鎮</span>
          <span v-else class="text-xs text-green-600">營地</span>
        </li>
      </ul>
    </div>

    <transition name="slide-right-favorite">
      <div
        v-if="isFavoritesListOpen"
        class="fixed top-0 right-0 z-40 bg-white p-4 rounded-l-lg shadow-xl w-4/5 md:w-[480px] h-full flex flex-col favorite-fade-panel"
      >
        <button
          @click="isFavoritesListOpen = false"
          class="favorite-close-btn"
          title="關閉我的最愛"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <h2 class="text-xl font-bold mb-4">我的最愛營地</h2>
        <div
          class="flex-1 flex flex-wrap gap-4 max-h-[calc(100vh-120px)] overflow-y-auto"
          style="align-content: flex-start"
        >
          <div
            v-for="camp in campgroundsStore.favoriteCampgrounds"
            :key="camp.id"
            class="favorite-card bg-blue-50 rounded-lg shadow p-4 flex flex-col"
          >
            <div class="flex justify-between items-center mb-2">
              <span class="font-semibold text-base">{{ camp.name }}</span>
              <button
                @click="campgroundsStore.removeFavorite(camp.id)"
                class="text-red-500 ml-2 text-sm"
              >
                移除
              </button>
            </div>
            <div
              v-if="
                weatherStore.favoriteCampgroundWeather[camp.id] &&
                Object.keys(weatherStore.favoriteCampgroundWeather[camp.id].weather || {}).length >
                  0
              "
            >
              <div class="favorite-week-scroll">
                <div
                  v-for="(hours, day) in weatherStore.favoriteCampgroundWeather[camp.id].weather"
                  :key="day"
                  class="favorite-week-card bg-white rounded-lg shadow-sm px-3 py-3 mr-1 flex flex-col items-center min-w-[120px] cursor-pointer hover:shadow-lg transition"
                  @click="openCampgroundPopup(camp)"
                >
                  <span class="font-bold text-blue-700 mb-1 text-xs">{{ day }}</span>
                  <span class="text-3xl mb-1">{{ hours[0].icon }}</span>
                  <span class="text-base mb-1">
                    <span class="text-red-600 text-xs"
                      >{{ Math.max(...hours.map((h) => h.temp)) }}°C</span
                    >
                    /
                    <span class="text-blue-600 text-xs"
                      >{{ Math.min(...hours.map((h) => h.temp)) }}°C</span
                    >
                  </span>
                  <span class="text-blue-500 text-xs mb-1"
                    >{{ hours.reduce((sum, h) => sum + h.rain, 0).toFixed(1) }} mm</span
                  >
                </div>
              </div>
            </div>
            <div v-else class="text-xs text-gray-400 mt-2">載入天氣中...</div>
          </div>
        </div>
        <p v-if="campgroundsStore.favoriteCampgrounds.length === 0" class="text-gray-500 mt-2">
          尚未加入任何最愛營地。
        </p>
      </div>
    </transition>

    <div
      v-if="weatherStore.isLoadingWeather"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black text-white px-4 py-2 rounded-full shadow-lg"
    >
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
  <transition name="slide-up">
    <div v-if="isBottomPopupOpen" class="bottom-full-popup-overlay">
      <div class="bottom-full-popup-content">
        <div class="flex justify-between items-center">
          <button @click="closeBottomPopup" class="bottom-popup-close-btn">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="{2}"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div class="mt-4 relative" v-html="bottomPopupContent"></div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'
import pointOnFeature from '@turf/point-on-feature'
import 'leaflet/dist/leaflet.css' // 引入 Leaflet 樣式
import '@fortawesome/fontawesome-free/css/all.min.css' // 引入 Font Awesome 樣式
import { useWeatherStore } from '@/stores/weather'
import { useCampgroundsStore } from '@/stores/campgrounds'

// 修正 Leaflet 預設圖標路徑問題 (避免 Marker 顯示為藍色方塊)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// 引入 Pinia Store
const weatherStore = useWeatherStore()
const campgroundsStore = useCampgroundsStore()

// 點擊 favorite-week-card 時在地圖上開啟對應營地 popup
const openCampgroundPopup = (camp) => {
  if (camp && camp.latitude && camp.longitude) {
    map.setView([camp.latitude, camp.longitude], 15, { animate: true })
    updateCampgroundMarkers.focusedCampId = camp.id
    updateCampgroundMarkers(true)
    onLocationClick(
      camp.name,
      camp.id,
      { lat: camp.latitude, lng: camp.longitude },
      'campground',
      isBottomPopupOpen,
    )
  }
}

// 地圖相關變數
let map = null // Leaflet 地圖實例
let countyGeoJsonLayer = null // 儲存縣市 GeoJSON 圖層實例 (用於樣式重置)
let townshipGeoJsonLayer = null // 新增：儲存鄉鎮 GeoJSON 圖層實例
let campgroundMarkersLayer = L.featureGroup() // 用於管理露營地 Marker 的圖層群組
let locationLabelsLayer = L.featureGroup() // 用於管理縣市/鄉鎮標籤 Marker 的圖層群組

// 預設地圖視圖
const initialMapView = { center: [24.76, 121.43], zoom: 10 } // 台灣中心點及初始縮放級別

// UI 狀態變數
const isSearchOpen = ref(false)
const searchQuery = ref('')
const isFavoritesListOpen = ref(false)
const isBottomPopupOpen = ref(false)
const bottomPopupContent = ref('')

// UI 狀態切換函數
const openSearch = () => {
  isSearchOpen.value = !isSearchOpen.value
}
const showFavoritesList = () => {
  isFavoritesListOpen.value = !isFavoritesListOpen.value
  if (isFavoritesListOpen.value) {
    // 如果我的最愛列表被打開
    isBottomPopupOpen.value = false // 關閉底部彈窗
  }
}
const closeBottomPopup = () => {
  isBottomPopupOpen.value = false
}

// 我的最愛天氣快取與自動查詢
import { nextTick } from 'vue'
watch(isFavoritesListOpen, async (open) => {
  if (open) {
    await nextTick()
    await weatherStore.fetchFavoriteCampgroundsWeather(campgroundsStore.favoriteCampgrounds)
  }
})

// 即時搜尋結果
const searchResults = ref([])

watch(searchQuery, (newQuery) => {
  if (!newQuery) {
    searchResults.value = []
    return
  }
  const keyword = newQuery.trim()
  if (!keyword) {
    searchResults.value = []
    return
  }
  // 搜尋縣市、鄉鎮、營地
  const counties = Object.values(weatherStore.locationCoordsMap).filter(
    (loc) => loc.type === 'county' && loc.name.includes(keyword),
  )
  const townships = Object.values(weatherStore.locationCoordsMap).filter(
    (loc) => loc.type === 'township' && loc.name.includes(keyword),
  )
  const campgrounds = campgroundsStore.campgrounds.filter(
    (camp) => camp.name && camp.name.includes(keyword),
  )
  searchResults.value = [
    ...counties.map((loc) => ({ type: 'county', name: loc.name, lat: loc.lat, lon: loc.lon })),
    ...townships.map((loc) => ({ type: 'township', name: loc.name, lat: loc.lat, lon: loc.lon })),
    ...campgrounds.map((camp) => ({
      type: 'campground',
      name: camp.name,
      lat: camp.latitude,
      lon: camp.longitude,
      id: camp.id,
    })),
  ]
})

// 搜尋功能 (即時顯示結果，按下搜尋則導航到第一個結果)
const performSearch = () => {
  if (searchResults.value.length > 0) {
    const first = searchResults.value[0]
    if (first.type === 'campground') {
      map.setView([first.lat, first.lon], 15)
      onLocationClick(first.name, first.id, { lat: first.lat, lng: first.lon }, 'campground', null)
    } else {
      map.setView([first.lat, first.lon], 12)
      onLocationClick(first.name, first.name, { lat: first.lat, lng: first.lon }, first.type, null)
    }
    isSearchOpen.value = false
  }
}

// 新增：搜尋結果點擊導航
function performSearchByItem(item) {
  if (item.type === 'campground') {
    map.setView([item.lat, item.lon], 15)
    updateCampgroundMarkers.focusedCampId = item.id
    updateCampgroundMarkers(true)
    onLocationClick(item.name, item.id, { lat: item.lat, lng: item.lon }, 'campground', null)
  } else {
    map.setView([item.lat, item.lon], 12)
    onLocationClick(item.name, item.name, { lat: item.lat, lng: item.lon }, item.type, null)
  }
  isSearchOpen.value = false
}

const markerLimit = ref(50) // 初始顯示 50 筆
const showLoadMore = ref(false) // 是否顯示載入更多按鈕

function loadAllMarkers() {
  markerLimit.value = Infinity
  showLoadMore.value = false
  updateCampgroundMarkers(true)
}

// --- 地圖初始化 ---
const initMap = async () => {
  if (map) {
    map.remove() // 如果地圖已存在，先移除，防止重複初始化
  }

  // 創建地圖實例並設定初始視圖
  map = L.map('mapContainer').setView(initialMapView.center, initialMapView.zoom)

  // 顯示定位按鈕，讓使用者自行選擇是否定位
  const locateBtn = L.control({ position: 'topleft' })
  locateBtn.onAdd = function () {
    const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom')
    btn.innerHTML = '📍 我的定位'
    btn.style.backgroundColor = 'white'
    btn.style.width = '90px'
    btn.style.height = '32px'
    btn.style.cursor = 'pointer'
    btn.onclick = function (e) {
      e.stopPropagation()
      map.locate({ setView: true, maxZoom: 12, enableHighAccuracy: true })
    }
    return btn
  }
  locateBtn.addTo(map)

  map.on('locationfound', (e) => {
    // userLocated = true; // 這裡沒有定義 userLocated，如果需要，請在外面宣告
    L.marker(e.latlng).addTo(map).bindPopup('您目前的位置').openPopup()
  })
  map.on('locationerror', (e) => {
    console.warn('定位失敗:', e.message)
  })

  // 添加 OpenStreetMap 基礎圖層
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

  // 將營地 Marker 和位置標籤圖層群組加入地圖
  campgroundMarkersLayer.addTo(map)
  locationLabelsLayer.addTo(map)

  // 1. 載入原始 GeoJSON 數據到 Pinia Store
  await weatherStore.loadTaiwanGeoJsonData()

  // 2. 從 Store 取得原始 GeoJSON 數據
  const countyData = weatherStore.taiwanCountyGeoJson
  const townshipData = weatherStore.taiwanTownshipGeoJson

  // 3. 準備一個陣列來儲存所有行政區的中心點經緯度
  const processedLocationCoords = []

  // 4. 處理縣市 GeoJSON：計算中心點並綁定事件
  if (countyData) {
    countyGeoJsonLayer = L.geoJSON(countyData, {
      style: (feature) => ({
        // 縣市邊界預設樣式
        fillColor: '#ADD8E6', // 淺藍色填充
        weight: 0,
        opacity: 0,
        color: 'white', // 白色邊框
        dashArray: '3',
        fillOpacity: 0.6,
      }),
      onEachFeature: (feature, layer) => {
        const countyName = feature.properties.COUNTYNAME // 假設 GeoJSON 中縣市名稱屬性為 COUNTYNAME
        const countyCode = feature.properties.COUNTYCODE || countyName // 假設縣市代碼為 COUNTYCODE

        // 修正宜蘭縣、基隆市、高雄市：若為 MultiPolygon，僅取最大面積且在本島範圍的 Polygon
        let featureForCenter = feature
        if (
          (countyName === '宜蘭縣' || countyName === '基隆市' || countyName === '高雄市') &&
          feature.geometry.type === 'MultiPolygon'
        ) {
          let maxArea = 0
          let maxPolygon = null
          feature.geometry.coordinates.forEach((coords) => {
            const poly = {
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: coords },
              properties: feature.properties,
            }
            const first = coords[0][0]
            const inTaiwan =
              first[0] > 119.8 && first[0] < 122 && first[1] > 21.8 && first[1] < 25.5
            const area = coords[0].length
            if (inTaiwan && area > maxArea) {
              maxArea = area
              maxPolygon = poly
            }
          })
          if (maxPolygon) featureForCenter = maxPolygon
        }
        // 使用 pointOnFeature 取得多邊形內部最靠近中心的點
        const point = pointOnFeature(featureForCenter)
        const center = point.geometry.coordinates
        processedLocationCoords.push({
          lat: center[1],
          lon: center[0],
          type: 'county',
          name: countyName,
          code: countyCode,
        })

        // 綁定點擊、滑鼠移入/移出事件到 GeoJSON 圖層
        layer.on({
          click: (e) => onLocationClick(countyName, countyCode, e.latlng, 'county', layer),
        })
      },
    }) // 不加 .addTo(map) 這裡，由 updateBoundaryLayers 管理
  }

  // 5. 處理鄉鎮 GeoJSON：計算中心點並建立圖層 (不立即添加到地圖)
  if (townshipData) {
    townshipGeoJsonLayer = L.geoJSON(townshipData, {
      // Assign to the new layer variable
      style: (feature) => ({
        // 鄉鎮邊界預設樣式
        fillColor: '#ADD8E6', // 淺藍色填充
        weight: 1,
        opacity: 0.8,
        color: 'gray', // 白色邊框
        dashArray: '5',
        fillOpacity: 0.6,
      }),
      onEachFeature: (feature, layer) => {
        const townshipName = feature.properties.TOWNNAME // 假設鄉鎮名稱屬性
        const countyName = feature.properties.COUNTYNAME // 假設所屬縣市名稱
        const townshipCode = feature.properties.TOWNCODE || townshipName // 假設鄉鎮代碼

        // 修正頭城鎮、基隆市中正區、高雄市旗津區：若為 MultiPolygon，僅取最大面積且在本島範圍的 Polygon
        let featureForCenter = feature
        if (
          (townshipName === '頭城鎮' ||
            (countyName === '基隆市' && townshipName === '中正區') ||
            (countyName === '高雄市' && townshipName === '旗津區')) &&
          feature.geometry.type === 'MultiPolygon'
        ) {
          let maxArea = 0
          let maxPolygon = null
          feature.geometry.coordinates.forEach((coords) => {
            const poly = {
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: coords },
              properties: feature.properties,
            }
            const first = coords[0][0]
            const inTaiwan =
              first[0] > 119.8 && first[0] < 122 && first[1] > 21.8 && first[1] < 25.5
            const area = coords[0].length
            if (inTaiwan && area > maxArea) {
              maxArea = area
              maxPolygon = poly
            }
          })
          if (maxPolygon) featureForCenter = maxPolygon
        }
        // 使用 pointOnFeature 計算中心
        const point = pointOnFeature(featureForCenter)
        const center = point.geometry.coordinates
        processedLocationCoords.push({
          lat: center[1],
          lon: center[0],
          type: 'township',
          name: townshipName,
          county: countyName,
          code: townshipCode,
        })

        // 綁定點擊事件到鄉鎮 GeoJSON 圖層
        layer.on({
          click: (e) => onLocationClick(townshipName, townshipCode, e.latlng, 'township', layer),
        })
      },
    }) // 不加 .addTo(map) 這裡，由 updateBoundaryLayers 管理
  }

  // 6. 將計算好的所有行政區中心點陣列更新到 Pinia Store
  weatherStore.setLocationCoordsMap(processedLocationCoords)

  // 7. 監聽地圖縮放和移動事件，動態更新縣市/鄉鎮標籤和邊界
  map.on('zoomend', () => {
    updateLocationLabels() // 更新標籤
    updateBoundaryLayers() // 更新邊界圖層
  })
  map.on('moveend', updateLocationLabels) // 只更新標籤，邊界圖層只在縮放時改變

  // 8. 監聽營地 Marker 顯示狀態，並更新地圖上的 Marker
  watch(
    () => campgroundsStore.showCampgroundMarkers,
    (newValue) => {
      if (!map) return
      markerLimit.value = 50
      updateCampgroundMarkers(newValue)
    },
  )
  map.on('moveend', () => {
    if (campgroundsStore.showCampgroundMarkers) {
      markerLimit.value = 50
      updateCampgroundMarkers(true)
    }
  })
  map.on('zoomend', () => {
    if (campgroundsStore.showCampgroundMarkers) {
      markerLimit.value = 50
      updateCampgroundMarkers(true)
    }
  })

  // 9. 初始顯示地圖標籤和邊界 (縣市或鄉鎮)
  await updateLocationLabels()
  await updateBoundaryLayers() // Call this initially
}

// 初始化地圖
onMounted(() => {
  initMap()
})

// 組件卸載前清理
onBeforeUnmount(() => {
  if (map) {
    map.off()
    map.remove()
    map = null
  }
})

// --- 縣市/鄉鎮 hover 效果 ---
function highlightFeature(e) {
  const layer = e.target
  layer.setStyle({
    weight: 3,
    color: '#666',
    fillOpacity: 0.7,
  })
  layer.bringToFront()
}

function resetHighlight(e) {
  const layer = e.target
  if (countyGeoJsonLayer && countyGeoJsonLayer.resetStyle) {
    countyGeoJsonLayer.resetStyle(layer)
  }
  if (townshipGeoJsonLayer && townshipGeoJsonLayer.resetStyle) {
    townshipGeoJsonLayer.resetStyle(layer)
  }
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: function (e) {
      // 取得區域名稱與代碼
      let name = feature.properties.TOWNNAME || feature.properties.COUNTYNAME || ''
      let code = feature.properties.TOWNCODE || feature.properties.COUNTYCODE || name
      let type = 'township'
      // 若地圖縮放 >= 12，強制顯示鄉鎮內容
      if (map.getZoom() < 12 && feature.properties.COUNTYNAME) {
        name = feature.properties.COUNTYNAME
        code = feature.properties.COUNTYCODE || name
        type = 'county'
      }
      onLocationClick(name, code, e.latlng, type, layer)
    },
  })
}

// --- 更新地圖上的縣市/鄉鎮邊界圖層 ---
async function updateBoundaryLayers() {
  const currentZoom = map.getZoom()
  const countyStyle = (feature) => ({
    // 縣市邊界預設樣式
    fillColor: '#ADD8E6', // 淺藍色填充
    weight: 0,
    opacity: 0,
    color: 'white', // 白色邊框
    dashArray: '3',
    fillOpacity: 0.6,
  })

  const townshipStyle = (feature) => ({
    // 鄉鎮邊界預設樣式
    fillColor: '#ADD8E6', // 淺藍色填充
    weight: 1,
    opacity: 0.8,
    color: 'gray', // 白色邊框
    dashArray: '5',
    fillOpacity: 0.6,
  })

  if (currentZoom >= 14) {
    // 移除所有行政區邊界圖層
    if (countyGeoJsonLayer && map.hasLayer(countyGeoJsonLayer)) {
      map.removeLayer(countyGeoJsonLayer)
    }
    if (townshipGeoJsonLayer && map.hasLayer(townshipGeoJsonLayer)) {
      map.removeLayer(townshipGeoJsonLayer)
    }
  } else if (currentZoom >= 12) {
    // 顯示鄉鎮邊界
    if (countyGeoJsonLayer && map.hasLayer(countyGeoJsonLayer)) {
      map.removeLayer(countyGeoJsonLayer) // 移除縣市圖層
    }
    if (townshipGeoJsonLayer && !map.hasLayer(townshipGeoJsonLayer)) {
      townshipGeoJsonLayer = L.geoJSON(weatherStore.taiwanTownshipGeoJson, {
        style: townshipStyle,
        onEachFeature: onEachFeature,
      }).addTo(map) // 添加鄉鎮圖層
    }
  } else {
    // 顯示縣市邊界
    if (townshipGeoJsonLayer && map.hasLayer(townshipGeoJsonLayer)) {
      map.removeLayer(townshipGeoJsonLayer) // 移除鄉鎮圖層
    }
    if (countyGeoJsonLayer && !map.hasLayer(countyGeoJsonLayer)) {
      countyGeoJsonLayer = L.geoJSON(weatherStore.taiwanCountyGeoJson, {
        style: countyStyle,
        onEachFeature: onEachFeature,
      }).addTo(map) // 添加縣市圖層
    }
  }
}

// --- 更新地圖上的縣市/鄉鎮標籤 (此函式邏輯不變，因為它已經根據 zoom 篩選了 loc.type) ---
async function updateLocationLabels() {
  const currentZoom = map.getZoom()
  console.log('目前地圖縮放層級：', currentZoom)
  locationLabelsLayer.clearLayers() // 清除所有現有的標籤

  let locationsToDisplay = []
  // 根據縮放級別篩選要顯示的行政區類型 (縣市或鄉鎮)
  if (currentZoom >= 14) {
    locationsToDisplay = []
  } else if (currentZoom >= 12) {
    locationsToDisplay = weatherStore.locationCoordsMap.filter((loc) => loc.type === 'township')
  } else {
    locationsToDisplay = weatherStore.locationCoordsMap.filter((loc) => loc.type === 'county')
  }

  // 進一步篩選：只顯示當前地圖視野內的地點，並準備查詢天氣
  const currentBounds = map.getBounds()
  // 改為陣列，允許同名鄉鎮（不同縣市）都顯示 marker
  const filteredLocationsForWeather = []
  for (const loc of locationsToDisplay) {
    if (
      loc &&
      typeof loc.lat === 'number' &&
      typeof loc.lon === 'number' &&
      isFinite(loc.lat) &&
      isFinite(loc.lon) &&
      currentBounds.contains([loc.lat, loc.lon])
    ) {
      filteredLocationsForWeather.push(loc)
    }
  }

  // 使用 local cache 儲存已載入過的天氣資料
  if (!updateLocationLabels.weatherCache) updateLocationLabels.weatherCache = {}
  const weatherCache = updateLocationLabels.weatherCache

  const placedMarkers = [] // [{x, y, marker, loc, weatherKey}]
  const minDistancePx = 52 // Minimum pixel distance between markers
  const markerRefs = {} // weatherKey -> marker
  for (const loc of filteredLocationsForWeather) {
    const weatherKey = loc.name + (loc.county ? '-' + loc.county : '')
    const cachedWeather = weatherCache[weatherKey]
    let labelContent
    if (cachedWeather) {
      // 已有天氣資料，直接顯示 icon/溫度
      labelContent = `
        <div class="p-1 rounded-md text-sm whitespace-nowrap flex flex-col items-center custom-marker" style="pointer-events: auto; cursor: pointer;">
          <span class="ml-1 text-2xl">${cachedWeather.icon || '❓'}</span>
          <span class="">${loc.name}</span>
          <span class="ml-1">${cachedWeather.temp ?? 'N/A'}°C</span>
        </div>
      `
    } else {
      // 尚未有天氣資料，顯示 loading 狀態
      labelContent = `
        <div class="p-1 rounded-md text-sm whitespace-nowrap flex flex-col items-center custom-marker" style="pointer-events: auto; cursor: pointer;">
          <span class="ml-1 text-2xl">⏳</span>
          <span class="">${loc.name}</span>
          <span class="ml-1">載入中</span>
        </div>
      `
    }
    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: labelContent,
      iconAnchor: [0, 0],
    })
    // Smart placement: try offset if too close to previous markers
    let latlng = L.latLng(loc.lat, loc.lon)
    let point = map.latLngToLayerPoint(latlng)
    let offsetAttempts = 0
    let foundSpot = false
    let offsetPx = [
      [0, 0], // 原點
      [20, -20],
      [20, 20],
      [-20, -20],
      [-20, 20],
      [40, 0],
      [0, 40],
      [-40, 0],
      [0, -40],
    ]
    while (offsetAttempts < offsetPx.length && !foundSpot) {
      let testPoint = L.point(
        point.x + offsetPx[offsetAttempts][0],
        point.y + offsetPx[offsetAttempts][1],
      )
      let tooClose = placedMarkers.some((pm) => {
        const dx = pm.x - testPoint.x
        const dy = pm.y - testPoint.y
        return Math.sqrt(dx * dx + dy * dy) < minDistancePx
      })
      if (!tooClose) {
        foundSpot = true
        point = testPoint
      } else {
        offsetAttempts++
      }
    }
    // 轉回地理座標
    const finalLatLng = map.layerPointToLatLng(point)
    const marker = L.marker(finalLatLng, { icon: customIcon })
    marker.on('click', (e) => onLocationClick(loc.name, loc.code, e.latlng, loc.type, null))
    locationLabelsLayer.addLayer(marker)
    placedMarkers.push({ x: point.x, y: point.y, marker, loc, weatherKey })
    markerRefs[weatherKey] = marker
  }

  // 批量獲取篩選後地點的當前天氣數據（非同步，回來後再更新 marker icon）
  const weatherResults = await weatherStore.fetchMultipleLocationWeather(
    Object.fromEntries(
      filteredLocationsForWeather.map((loc) => [
        loc.name + (loc.county ? '-' + loc.county : ''),
        loc,
      ]),
    ),
  )

  // 更新 marker icon/溫度，並寫入 cache
  for (const pm of placedMarkers) {
    const weather = weatherResults[pm.weatherKey]
    if (weather) weatherCache[pm.weatherKey] = weather
    const labelContent = `
      <div class="p-1 rounded-md text-sm whitespace-nowrap flex flex-col items-center custom-marker" style="pointer-events: auto; cursor: pointer;">
        <span class="ml-1 text-2xl">${weather ? weather.icon : '❓'}</span>
        <span class="">${pm.loc.name}</span>
        <span class="ml-1">${weather ? weather.temp : 'N/A'}°C</span>
      </div>
    `
    pm.marker.setIcon(
      L.divIcon({
        className: 'custom-div-icon',
        html: labelContent,
        iconAnchor: [0, 0],
      }),
    )
  }
}

// --- 點擊行政區/露營地 Marker 事件處理 ---
async function onLocationClick(name, code, latlng, type, layer) {
  console.log(`點擊了 ${type}:`, name, `代碼/ID: ${code}`)

  // 確保底部彈窗打開時，關閉我的最愛列表
  if (isFavoritesListOpen.value) {
    isFavoritesListOpen.value = false
  }

  // 1. 先將地圖平移到 marker 位置（畫面中央）
  if (latlng && latlng.lat && latlng.lng) {
    map.panTo([latlng.lat, latlng.lng], { animate: true })
  }

  // 2. 獲取並顯示該地點的一週天氣預報
  await weatherStore.fetchHourlyForecast(latlng.lat, latlng.lng)

  // 3. 顯示底部滿版區塊內容
  const content = generatePopupContent(name, latlng, type, code)
  bottomPopupContent.value = content //
  isBottomPopupOpen.value = true // 開啟底部彈窗

  // 4. Popup 開啟後，為「加入我的最愛」按鈕綁定事件（直接 setTimeout，確保 DOM 已插入）
  nextTick(() => {
    const addToFavoriteBtn = document.getElementById('add-to-favorite-btn')
    if (addToFavoriteBtn) {
      const currentName = name
      const currentLatlng = latlng
      const currentType = type
      const currentCode = code
      addToFavoriteBtn.onclick = () => {
        if (currentType === 'campground') {
          const camp = campgroundsStore.campgrounds.find(
            (c) => String(c.id) === String(currentCode),
          )
          if (camp) {
            const isAlreadyFavorite = campgroundsStore.favoriteCampgrounds.some(
              (fav) => String(fav.id) === String(camp.id),
            )
            if (isAlreadyFavorite) {
              campgroundsStore.removeFavorite(camp.id)
              alert(`${camp.name} 已從我的最愛移除！`)
            } else {
              campgroundsStore.addFavorite(camp)
              alert(`${camp.name} 已加入我的最愛！`)
            }
            bottomPopupContent.value = generatePopupContent(
              currentName,
              currentLatlng,
              currentType,
              currentCode,
            )
          }
        } else {
          alert(
            `${currentName} (${currentType === 'county' ? '縣市' : '鄉鎮'}) 暫時無法直接收藏，請點擊營地！`,
          )
        }
      }
    }
  })
}

// --- 根據 Store 中的數據生成 Popup 內容 ---
function generatePopupContent(name, latlng, type, code) {
  const forecast = weatherStore.selectedLocationForecast
  let forecastHtml = ''
  // 表頭只顯示一次，forecastHtml 不包含 headerHtml
  const headerHtml = `
    <div class="windy-hour-card w-20 md:w-32 p-1 text-right font-bold bg-gray-100 sticky left-0 z-10">
      <div class="text-xs/7 text-gray-500" style="height:20px">日期 <i class="fa-regular fa-calendar"></i></div>
      <div class="text-xs/7 text-gray-500" style="height:28px">小時 <i class="fa-regular fa-clock"></i></div>
      <div class="text-xs text-gray-500" style="height:32px;line-height:32px;"> </div>
      <div class="text-xs/7 text-gray-500" style="height:28px">溫度 °C</div>
      <div class="text-xs/7 text-gray-500" style="height:28px">降雨量 mm</div>
      <div class="text-xs/7 text-gray-500" style="height:28px">降雨機率 %</div>
    </div>
  `
  // 預期 forecast 結構: { time: [...], temperature_2m: [...], precipitation: [...], weather_code: [...] }
  if (
    forecast &&
    forecast.time &&
    forecast.temperature_2m &&
    forecast.precipitation &&
    forecast.weather_code &&
    forecast.precipitation_probability
  ) {
    // 分組每天
    const days = {}
    for (let i = 0; i < forecast.time.length; i++) {
      const dateObj = new Date(forecast.time[i])
      const dayKey = dateObj.toLocaleDateString('zh-TW', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
      })
      if (!days[dayKey]) days[dayKey] = []
      days[dayKey].push({
        hour: dateObj.getHours(),
        temp: Math.round(forecast.temperature_2m[i]),
        rain: forecast.precipitation[i],
        rainProb: forecast.precipitation_probability[i],
        icon: weatherStore.getIconForWeatherCode(forecast.weather_code[i]),
      })
    }
    forecastHtml = `
      <div class="flex flex-row pt-1 pb-1">
        ${Object.entries(days)
          .map(
            ([day, hours], i) => `
              <div class="mb-2 flex flex-col${i < 6 ? ' divide' : ''}">
                <div class="text-sm text-gray-500 pl-2">${day}</div>
                <div class="windy-scroll-wrapper flex flex-row overflow-x-auto pb-2 relative">
                  ${hours
                    .map(
                      (h, idx) => `
                        <div class="windy-hour-card${(idx >= 0 && idx <= 5) || (idx >= 18 && idx <= 23) ? ' windy-hour-card-bg' : ''}">
                          <div class="text-xs/7 text-gray-500 text-center">${h.hour}</div>
                          <div class="text-2xl text-center">${h.icon}</div>
                          <div class="font-bold text-xs/7 text-center">${h.temp}</div>
                          ${h.rain && h.rain !== 0 ? `<div class="text-xs/7 text-blue-600 text-center">${h.rain}</div>` : '<div class="text-xs/7 text-blue-200 text-center">-</div>'}
                          ${Math.round(h.rainProb / 10) * 10 !== 0 ? `<div class="text-xs/7 text-blue-400 text-center">${Math.round(h.rainProb / 10) * 10}</div>` : '<div class="text-xs/7 text-blue-200 text-center">-</div>'}
                        </div>
                      `,
                    )
                    .join('')}
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    `
  } else if (weatherStore.isLoadingWeather) {
    forecastHtml = '<p>載入預報中...</p>'
  } else {
    forecastHtml = '<p class="text-red-500">無法取得預報資料。</p>'
  }

  // 右側「關於地點」內容
  let locationDetailsHtml = ''
  if (type === 'campground') {
    const camp = campgroundsStore.campgrounds.find((c) => String(c.id) === String(code))
    if (camp) {
      locationDetailsHtml = `
        <h4 class="text-sm mb-2">關於地點</h4>
        <p class="text-sm text-gray-600">營地: ${camp.name}</p>
        <p class="text-sm text-gray-600">海拔: ${camp.altitude}</p>
        <p class="text-sm text-gray-600 mb-2">座標: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}</p>
        <a
            href="https://www.google.com/maps/dir/?api=1&destination=${latlng.lat},${latlng.lng}"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-2 text-blue-600 underline text-sm"
            title="Google 導航"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="inline-block h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 3v4m0 0V3m0 4h-4m4 0h4m-4 0v4m0-4v4m0 0H3m0 0v4m0-4h4m-4 0v4m0-4h4" /></svg>
            Google導航
          </a>
        <a href="https://www.windy.com/?${latlng.lat},${latlng.lng},11,marker" target="_blank" rel="noopener noreferrer" class="ml-2 text-blue-600 underline text-sm"><svg xmlns="http://www.w3.org/2000/svg" class="inline-block h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 3v4m0 0V3m0 4h-4m4 0h4m-4 0v4m0-4v4m0 0H3m0 0v4m0-4h4m-4 0v4m0-4h4" /></svg>Windy</a>
        <a href="https://www.cwa.gov.tw/V8/C/" target="_blank" rel="noopener noreferrer" class="ml-2 text-blue-600 underline text-sm"><svg xmlns="http://www.w3.org/2000/svg" class="inline-block h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 3v4m0 0V3m0 4h-4m4 0h4m-4 0v4m0-4v4m0 0H3m0 0v4m0-4h4m-4 0v4m0-4h4" /></svg>中央氣象局</a>
        `
    }
  } else {
    // 對於縣市或鄉鎮類型
    locationDetailsHtml = `
      <h4 class="text-sm mb-2">關於地點</h4>
      <p class="text-sm text-gray-600">地點: ${name}</p>
      <p class="text-sm text-gray-600">類型: ${type === 'county' ? '縣市' : '鄉鎮'}</p>
      <p class="text-sm text-gray-600">座標: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}</p>
    `
  }

  // 根據類型決定「加入我的最愛」按鈕的顯示狀態
  const isFavorite = (campgroundsStore.favoriteCampgrounds ?? []).some(
    (fav) => String(fav.id) === String(code),
  )
  const heartIcon = isFavorite
    ? '<i class="fa-solid fa-heart text-red-500 text-lg"></i>'
    : '<i class="fa-regular fa-heart text-gray-500 text-lg"></i>'
  const favoriteButtonHtml =
    type === 'campground'
      ? `<div class="add-to-favorite-btn mt-4">
        <button id="add-to-favorite-btn" class="flex items-center text-md font-medium text-blue-600 hover:text-blue-800 transition-colors" title="加入我的最愛">
          ${heartIcon}
        </button>
      </div>`
      : ''

  return `
    <div class="flex flex-col-reverse md:flex-row md:space-x-4">
      <div class="w-full md:w-7/10" style="position:relative;">
        <div id="popup-forecast-hourly" style="position:relative;overflow: hidden;">
          ${headerHtml}
          <div
            id="forecast-hourly-scroll"
            class="left-20 md:left-32"
            style="overflow-x:auto;position:absolute; top:0; cursor:grab; z-index:101; width:calc(100% - 100px);"
            onmousedown="startDragHourlyScroll(event)"
          >
            ${forecastHtml}
          </div>
        </div>
      </div>
      <div class="w-full md:w-3/10 mb-4 md:mb-0 p-4 bg-gray-50 rounded-lg shadow-sm">
        ${locationDetailsHtml}
      </div>
    </div>
    ${favoriteButtonHtml}
  `
}

// --- 營地 Marker 相關功能 ---
function updateCampgroundMarkers(show) {
  if (!map) return
  campgroundMarkersLayer.clearLayers()
  if (show) {
    const zoom = map.getZoom()
    let visibleCampgrounds = []
    if (zoom >= 14) {
      // 縮放級別 >= 14 顯示視野內全部
      visibleCampgrounds = campgroundsStore.campgrounds.filter((camp) =>
        map.getBounds().contains([camp.latitude, camp.longitude]),
      )
    } else if (zoom >= 12) {
      // 縮放級別 >= 12 且 < 14 依鄉鎮分組，視野內每個鄉鎮只取前 5 個營地
      const visibleCampsByTown = {}
      campgroundsStore.campgrounds.forEach((camp) => {
        if (!map.getBounds().contains([camp.latitude, camp.longitude])) return
        const town = camp.town || camp.township || camp.townName || camp.town_name || '未知鄉鎮'
        if (!visibleCampsByTown[town]) visibleCampsByTown[town] = []
        if (visibleCampsByTown[town].length < 5) {
          visibleCampsByTown[town].push(camp)
          visibleCampgrounds.push(camp)
        }
      })
      visibleCampgrounds = Object.values(visibleCampsByTown).flat()
    } else {
      // 縮放級別 < 12 依縣市分組，視野內每個縣市只取前 5 個營地
      const visibleCampsByCounty = {}
      campgroundsStore.campgrounds.forEach((camp) => {
        if (!map.getBounds().contains([camp.latitude, camp.longitude])) return
        const county = camp.county || '未知縣市' // 假設你的數據中有縣市屬性
        if (!visibleCampsByCounty[county]) visibleCampsByCounty[county] = []
        if (visibleCampsByCounty[county].length < 5) {
          visibleCampsByCounty[county].push(camp)
          visibleCampgrounds.push(camp)
        }
      })
      visibleCampgrounds = Object.values(visibleCampsByCounty).flat()
    }
    showLoadMore.value = false

    // 追蹤 focus 狀態的營地 id
    if (typeof updateCampgroundMarkers.focusedCampId === 'undefined')
      updateCampgroundMarkers.focusedCampId = null
    visibleCampgrounds.forEach((camp) => {
      if (camp.latitude && camp.longitude) {
        // 定義 isFocused 變數
        const isFocused = camp.id === updateCampgroundMarkers.focusedCampId
        const campIcon = L.divIcon({
          className: 'gmap-marker',
          html: `<span class="gmap-marker-bg${isFocused ? ' focused' : ''}"><i class="fa-solid fa-campground"></i></span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        })
        const marker = L.marker([camp.latitude, camp.longitude], { icon: campIcon })
        marker.on('click', (e) => {
          updateCampgroundMarkers.focusedCampId = camp.id
          updateCampgroundMarkers(true) // 重新渲染所有 marker icon
          onLocationClick(camp.name, camp.id, e.latlng, 'campground', null)
        })
        marker.bindTooltip(camp.name, { permanent: false, direction: 'top' })
        campgroundMarkersLayer.addLayer(marker)
      }
    })
  }
}

// --- 地圖基本互動 ---
const resetMapView = () => {
  map.setView(initialMapView.center, initialMapView.zoom)
}

// --- 拖移 #forecast-hourly-scroll ---
let dragHourlyScroll = null
let dragStartX = 0
let dragStartScrollLeft = 0
function startDragHourlyScroll(e) {
  const scrollDiv = document.getElementById('forecast-hourly-scroll')
  if (!scrollDiv) return
  dragHourlyScroll = scrollDiv
  dragStartX = e.clientX
  dragStartScrollLeft = scrollDiv.scrollLeft
  scrollDiv.style.cursor = 'grabbing'
  document.addEventListener('mousemove', onDragHourlyScroll)
  document.addEventListener('mouseup', stopDragHourlyScroll)
}
function onDragHourlyScroll(e) {
  if (!dragHourlyScroll) return
  const dx = dragStartX - e.clientX
  dragHourlyScroll.scrollLeft = dragStartScrollLeft + dx
}
function stopDragHourlyScroll() {
  if (dragHourlyScroll) dragHourlyScroll.style.cursor = 'grab'
  dragHourlyScroll = null
  document.removeEventListener('mousemove', onDragHourlyScroll)
  document.removeEventListener('mouseup', stopDragHourlyScroll)
}
window.startDragHourlyScroll = startDragHourlyScroll
</script>

<style scoped>
/* 確保地圖容器有明確的高度和寬度 */
#mapContainer {
  height: 100vh;
  width: 100vw;
}

/* 樣式化功能按鈕 */
/* .btn-icon 樣式直接用 Tailwind 類名於 template 中，不需 @apply */

/* 我的最愛卡片式樣式 */
.favorite-card {
  width: 100%;
  transition:
    box-shadow 0.2s,
    transform 0.2s;
}

/* 右側滑入動畫 */
.slide-right-favorite-enter-active,
.slide-right-favorite-leave-active {
  transition:
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s;
}
.slide-right-favorite-enter-from,
.slide-right-favorite-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
.slide-right-favorite-enter-to,
.slide-right-favorite-leave-from {
  transform: translateX(0);
  opacity: 1;
}

/* 一週天氣橫向排列卡片 */
.favorite-week-scroll {
  display: flex;
  flex-direction: row;
  gap: 0.1rem;
  overflow-x: hidden;
  padding-bottom: 4px;
}
.favorite-week-card {
  min-width: 100px;
  max-width: 100px;
  background: #f8fbff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 64, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
}
/* 預報卡片橫向捲動區 sticky 表頭 */
.windy-scroll-wrapper {
  position: relative;
}
.windy-hour-card.sticky {
  position: sticky;
  left: 0;
  z-index: 10;
  background: #f3f4f6;
  border-right: 1px solid #e5e7eb;
}

.btn-icon {
  background-color: #ffffff;
  border-radius: 50%;
  padding: 10px;
  cursor: pointer;
}

:deep(.custom-marker) {
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 10px 12px;
}

:deep(.windy-hour-card-bg) {
  background: #eaeaf5;
  background: linear-gradient(180deg, rgba(234, 234, 245, 1) 0%, rgba(234, 234, 245, 0) 100%);
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

/* :deep(.custom-marker) {
  background: rgba(0, 0, 0, 1);
  color: #fff;
  padding: 10px 12px;
} */

/* 可以為 Popup 添加一些自定義樣式 */
:deep(.leaflet-popup-content-wrapper) {
  border-radius: 8px;
  padding: 10px;
}
:deep(.leaflet-popup-content) {
  margin: 0;
}

:deep(.divide) {
  border-inline-start-width: 0px;
  border-inline-end-width: 1px;
  border-color: #e7ebf1;
}

/* 滑動淡入過渡效果 */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition:
    opacity 0.5s,
    transform 0.5s;
}
.slide-fade-enter, .slide-fade-leave-to /* .slide-fade-leave-active 在舊版 Vue 中使用 */ {
  opacity: 0;
  transform: translateY(10px);
}

/* 底部滿版 Popup 樣式 */
.bottom-full-popup-overlay {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 50vh;
  max-height: 80%;
  background-color: transparent;
  z-index: 30;
  display: flex;
  pointer-events: none;
  flex-direction: row;
}

/* 底部滿版 Popup 的內容區 */
.bottom-full-popup-content {
  background-color: white; /* 白色背景 */
  width: 100%; /* 內容區寬度佔滿父容器（這裡就是 overlay 的 100%） */
  padding: 0.8rem; /* 內邊距 */
  box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.2); /* 頂部陰影 */
  pointer-events: auto; /* 內容區可以捕獲點擊事件 */
  transform: translateY(0); /* 初始狀態，無位移 */
  opacity: 1; /* 初始狀態，完全不透明 */
}

@media (width >= 48rem) {
  .bottom-full-popup-overlay {
    height: 240px;
  }
  .bottom-full-popup-content {
    padding: 1.5rem 1.5rem 1.5rem 0; /* 內邊距 */
  }
}

/* 新增底部 Popup 關閉按鈕的樣式 */
.bottom-popup-close-btn {
  position: absolute; /* 相對於父元素 .bottom-full-popup-content 定位 */
  top: -3rem;
  left: 1rem;
  background: rgba(255, 255, 255, 0.85);
  border: none;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10; /* 確保在內容之上，可選 */
  transition: background 0.2s;
}

.bottom-popup-close-btn:hover {
  background: #f3f4f6; /* 從 favorite-close-btn 複製 */
}

/* Vue 過渡效果樣式 */
/* slide-up-enter-active: 進入中的狀態，從進入前到進入後 */
/* slide-up-leave-active: 離開中的狀態，從離開前到離開後 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.3s ease-out,
    opacity 0.3s ease-out; /* 定義過渡效果 */
}

/* slide-up-enter-from: 進入前的狀態 (Vue 3) */
/* slide-up-leave-to: 離開後的狀態 (Vue 3) */
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%); /* 從底部完全移出 */
  opacity: 0; /* 完全透明 */
}

/* slide-up-enter-to: 進入後的狀態 (Vue 3) */
/* slide-up-leave-from: 離開前的狀態 (Vue 3) */
.slide-up-enter-to,
.slide-up-leave-from {
  transform: translateY(0); /* 移動到最終位置 */
  opacity: 1; /* 完全不透明 */
}

/* 我的最愛關閉按鈕（左上角 X） */
.favorite-close-btn {
  position: absolute;
  top: 18px;
  left: -50px;
  background: rgba(255, 255, 255, 0.85);
  border: none;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: background 0.2s;
}
.favorite-close-btn:hover {
  background: #f3f4f6;
}

#forecast-hourly-scroll {
  overflow-x: auto;
  position: relative;
  width: 100%;
  cursor: grab;
}
</style>
