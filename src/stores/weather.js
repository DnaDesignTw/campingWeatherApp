// src/stores/weather.js
import { ref } from 'vue';
import { defineStore } from 'pinia';
import apiClient from '@/plugins/axios'; // 引入你的 axios 實例
import axios from 'axios'; // 再次引入 axios 用於載入本地 GeoJSON 檔案

export const useWeatherStore = defineStore('weather', () => {
  const countyWeather = ref({}); // 儲存縣市天氣數據 { '台北市': { temp: 25, icon: '...', weatherCode: 1 } }
  const townshipWeather = ref({}); // 儲存鄉鎮天氣數據 { '信義區': { temp: 24, icon: '...', weatherCode: 2 } }
  const selectedLocationForecast = ref(null); // 儲存點擊地點的一週天氣預報
  const isLoadingWeather = ref(false);
  // 用於儲存原始 GeoJSON 數據
  const taiwanCountyGeoJson = ref(null);
  const taiwanTownshipGeoJson = ref(null);

  // 儲存行政區名稱到其經緯度中心點的映射
  // 這個會由 CampgroundsView.vue 載入 GeoJSON 後計算並填充
  const locationCoordsMap = ref({}); // { '台北市': { lat: ..., lon: ..., type: 'county', code: '...' }, '信義區': { lat: ..., lon: ..., type: 'township', code: '...' } }

  function setLocationCoordsMap(mapData) {
    locationCoordsMap.value = mapData;
    console.log('locationCoordsMap 已更新:', locationCoordsMap.value);
  }

  // 簡易天氣代碼到圖標的映射 (Open-Meteo Weather Codes)
  const weatherCodeIcons = {
      0: '☀️', // Clear sky
      1: '🌤️', // Mainly clear
      2: '⛅', // Partly cloudy
      3: '☁️', // Overcast
      45: '🌫️', // Fog
      48: '🌫️', // Depositing rime fog
      51: '🌧️', // Drizzle: Light
      53: '🌧️', // Drizzle: Moderate
      55: '🌧️', // Drizzle: Dense
      56: '🌧️', // Freezing Drizzle: Light
      57: '🌧️', // Freezing Drizzle: Dense
      61: '🌦️', // Rain: Slight
      63: '🌧️', // Rain: Moderate
      65: '🌧️', // Rain: Heavy
      66: '🌨️', // Freezing Rain: Light
      67: '🌨️', // Freezing Rain: Heavy
      71: '❄️', // Snow fall: Slight
      73: '❄️', // Snow fall: Moderate
      75: '❄️', // Snow fall: Heavy
      77: '🌨️', // Snow grains
      80: '⛈️', // Rain showers: Slight
      81: '⛈️', // Rain showers: Moderate
      82: '⛈️', // Rain showers: Violent
      85: '🌨️', // Snow showers: Slight
      86: '🌨️', // Snow showers: Heavy
      95: '🌩️', // Thunderstorm: Slight or moderate
      96: '⛈️', // Thunderstorm with slight hail
      99: '⛈️', // Thunderstorm with heavy hail
      // ...你可以擴展更多圖標
  };

  // 根據天氣代碼獲取圖標
  const getIconForWeatherCode = (code) => weatherCodeIcons[code] || '❓';

  // --- 新增：載入 GeoJSON 數據的 actions ---
  async function loadTaiwanGeoJsonData() {
    if (taiwanCountyGeoJson.value && taiwanTownshipGeoJson.value) return; // 避免重複載入

    isLoadingWeather.value = true;
    try {
      // 載入縣市 GeoJSON
      const countyResponse = await axios.get('/data/taiwan_cityships_2024.geojson'); // 假設這是你的縣市 GeoJSON 檔案名
      taiwanCountyGeoJson.value = countyResponse.data;
      console.log('載入縣市 GeoJSON 完成');

      // 載入鄉鎮 GeoJSON (替換成你實際的鄉鎮 GeoJSON 檔案名)
      const townshipResponse = await axios.get('/data/taiwan_townships_2024.geojson'); // 假設這是你的鄉鎮 GeoJSON 檔
      taiwanTownshipGeoJson.value = townshipResponse.data;
      console.log('載入鄉鎮 GeoJSON 完成');

    } catch (error) {
      console.error('載入台灣地理數據失敗:', error);
    } finally {
      isLoadingWeather.value = false;
    }
  }
  // 獲取多個地點的天氣 (當前溫度和天氣代碼)
  // --- 新增：天氣快取（10分鐘內重複查詢直接回傳快取） ---
  const weatherCache = {};
  const CACHE_DURATION = 10 * 60 * 1000; // 10分鐘（毫秒）

  async function fetchMultipleLocationWeather(locations) {
    isLoadingWeather.value = true;
    const weatherData = {};
    const requests = [];
    const now = Date.now();

    for (const locName in locations) {
      const { lat, lon } = locations[locName];
      if (lat && lon) {
        // 檢查快取
        if (
          weatherCache[locName] &&
          (now - weatherCache[locName].timestamp < CACHE_DURATION)
        ) {
          weatherData[locName] = weatherCache[locName].data;
        } else {
          requests.push(
            apiClient
              .get(
                `forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weather_code&current=temperature_2m,weather_code&timezone=Asia%2FTaipei&forecast_days=1`
              )
              .then((response) => {
                const currentTemp = response.data.current?.temperature_2m;
                const currentWeatherCode = response.data.current?.weather_code;
                const result = {
                  temp: currentTemp !== undefined ? Math.round(currentTemp) : 'N/A',
                  weatherCode: currentWeatherCode,
                  icon: getIconForWeatherCode(currentWeatherCode),
                };
                weatherData[locName] = result;
                // 寫入快取
                weatherCache[locName] = {
                  data: result,
                  timestamp: Date.now(),
                };
              })
              .catch((error) => {
                console.error(`Failed to fetch weather for ${locName}:`, error);
                weatherData[locName] = { temp: 'N/A', icon: '❓' };
              })
          );
        }
      }
    }
    if (requests.length > 0) {
      await Promise.all(requests);
    }
    isLoadingWeather.value = false;
    return weatherData;
  }

  // 獲取單一地點的一週天氣預報 (用於 Popup)
  async function fetchOneWeekForecast(lat, lon) {
    isLoadingWeather.value = true;
    try {
      const response = await apiClient.get(`forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia%2FTaipei&forecast_days=7`);
      selectedLocationForecast.value = response.data.daily;
    } catch (error) {
      console.error('Failed to fetch 7-day forecast:', error);
      selectedLocationForecast.value = null;
    } finally {
      isLoadingWeather.value = false;
    }
  }

  // --- 我的最愛營地天氣快取（一天有效） ---
  const favoriteCampgroundWeather = ref({}); // { [campId]: { weather, timestamp } }
  const FAVORITE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 1天（毫秒）

  /**
   * 查詢多個營地天氣，只查詢新加入或快取過期的營地
   * @param {Array} campgrounds [{ id, name, latitude, longitude }]
   * @returns {Object} { [campId]: weatherData }
   */
  async function fetchFavoriteCampgroundsWeather(campgrounds) {
    isLoadingWeather.value = true;
    const now = Date.now();
    const requests = [];
    const result = {};

    for (const camp of campgrounds) {
      if (!camp.id || !camp.latitude || !camp.longitude) continue;
      const cache = favoriteCampgroundWeather.value[camp.id];
      if (cache && (now - cache.timestamp < FAVORITE_CACHE_DURATION)) {
        // 使用快取
        result[camp.id] = cache.weather;
      } else {
        // 需查詢
        requests.push(
          apiClient
            .get(`forecast?latitude=${camp.latitude}&longitude=${camp.longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia%2FTaipei&forecast_days=7`)
            .then((response) => {
              const daily = response.data.daily;
              // 格式化一週天氣
              const weatherArr = daily.time.map((t, i) => ({
                date: new Date(t).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' }),
                min: Math.round(daily.temperature_2m_min[i]),
                max: Math.round(daily.temperature_2m_max[i]),
                icon: getIconForWeatherCode(daily.weather_code[i])
              }));
              result[camp.id] = weatherArr;
              // 寫入快取
              favoriteCampgroundWeather.value[camp.id] = {
                weather: weatherArr,
                timestamp: Date.now(),
              };
            })
            .catch((error) => {
              console.error(`Failed to fetch weather for favorite camp ${camp.name}:`, error);
              result[camp.id] = [];
            })
        );
      }
    }
    if (requests.length > 0) {
      await Promise.all(requests);
    }
    isLoadingWeather.value = false;
    return result;
  }

  return {
    countyWeather,
    townshipWeather,
    selectedLocationForecast,
    isLoadingWeather,
    taiwanCountyGeoJson,
    taiwanTownshipGeoJson,
    locationCoordsMap, // 暴露這個映射表
    setLocationCoordsMap,
    getIconForWeatherCode,
    loadTaiwanGeoJsonData, // 暴露載入 GeoJSON 的 action
    fetchMultipleLocationWeather,
    fetchOneWeekForecast,
    // 我的最愛專用
    favoriteCampgroundWeather,
    fetchFavoriteCampgroundsWeather,
  };
});