// src/stores/weather.js
import { ref } from 'vue'
import { defineStore } from 'pinia'
import apiClient from '@/plugins/axios' // 引入你的 axios 實例
import axios from 'axios' // 再次引入 axios 用於載入本地 GeoJSON 檔案

export const useWeatherStore = defineStore('weather', () => {
  const countyWeather = ref({})
  const townshipWeather = ref({})
  const selectedLocationForecast = ref(null)
  const isLoadingWeather = ref(false)

  // 1. 新增：用於追蹤 GeoJSON 載入狀態
  const isGeoJsonLoading = ref(false)
  const isGeoJsonLoaded = ref(false)

  // 用於儲存原始 GeoJSON 數據
  const taiwanCountyGeoJson = ref(null)
  const taiwanTownshipGeoJson = ref(null)

  // 儲存行政區名稱到其經緯度中心點的映射
  const locationCoordsMap = ref([])

  function setLocationCoordsMap(mapData) {
    locationCoordsMap.value = mapData
  }

  // 簡易天氣代碼到圖標的映射 (Open-Meteo Weather Codes)
  const weatherCodeIcons = {
    0: '☀️',
    1: '🌤️',
    2: '⛅',
    3: '☁️',
    45: '🌫️',
    48: '🌫️',
    51: '🌧️',
    53: '🌧️',
    55: '🌧️',
    56: '🌧️',
    57: '🌧️',
    61: '🌦️',
    63: '🌧️',
    65: '🌧️',
    66: '🌨️',
    67: '🌨️',
    71: '❄️',
    73: '❄️',
    75: '❄️',
    77: '🌨️',
    80: '⛈️',
    81: '⛈️',
    82: '⛈️',
    85: '🌨️',
    86: '🌨️',
    95: '🌩️',
    96: '⛈️',
    99: '⛈️',
  }

  const getIconForWeatherCode = (code) => weatherCodeIcons[code] || '❓'

  // --- 2. 修改：載入 GeoJSON 數據的 actions ---
  async function loadProcessedLocations() {
    // 如果已經載入過，直接返回，避免重複請求
    if (isGeoJsonLoaded.value) return

    isGeoJsonLoading.value = true
    try {
      const url = `${import.meta.env.BASE_URL}data/processed-locations.json`
      const response = await axios.get(url)
      locationCoordsMap.value = response.data
      console.log('已載入處理後的地理位置資料。')
      isGeoJsonLoaded.value = true // 標記為已載入
    } catch (error) {
      console.error('載入台灣地理數據失敗:', error)
      isGeoJsonLoaded.value = false // 載入失敗，將狀態設回 false
    } finally {
      isGeoJsonLoading.value = false // 無論成功失敗，都結束載入中狀態
    }
  }

  // 獲取多個地點的天氣 (當前溫度和天氣代碼)
  const weatherCache = {}
  const CACHE_DURATION = 10 * 60 * 1000

  async function fetchMultipleLocationWeather(locations) {
    isLoadingWeather.value = true
    const weatherData = {}
    const requests = []
    const now = Date.now()

    for (const locName in locations) {
      const { lat, lon } = locations[locName]
      if (lat && lon) {
        if (weatherCache[locName] && now - weatherCache[locName].timestamp < CACHE_DURATION) {
          weatherData[locName] = weatherCache[locName].data
        } else {
          requests.push(
            apiClient
              .get(
                `forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weather_code&current=temperature_2m,weather_code&timezone=Asia%2FTaipei&forecast_days=1`,
              )
              .then((response) => {
                const currentTemp = response.data.current?.temperature_2m
                const currentWeatherCode = response.data.current?.weather_code
                const result = {
                  temp: currentTemp !== undefined ? Math.round(currentTemp) : 'N/A',
                  weatherCode: currentWeatherCode,
                  icon: getIconForWeatherCode(currentWeatherCode),
                }
                weatherData[locName] = result
                weatherCache[locName] = {
                  data: result,
                  timestamp: Date.now(),
                }
              })
              .catch((error) => {
                console.error(`Failed to fetch weather for ${locName}:`, error)
                weatherData[locName] = { temp: 'N/A', icon: '❓' }
              }),
          )
        }
      }
    }
    if (requests.length > 0) {
      await Promise.all(requests)
    }
    isLoadingWeather.value = false
    return weatherData
  }

  async function fetchOneWeekForecast(lat, lon) {
    isLoadingWeather.value = true
    try {
      const response = await apiClient.get(
        `forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia%2FTaipei&forecast_days=7`,
      )
      selectedLocationForecast.value = response.data.daily
    } catch (error) {
      console.error('Failed to fetch 7-day forecast:', error)
      selectedLocationForecast.value = null
    } finally {
      isLoadingWeather.value = false
    }
  }

  async function fetchHourlyForecast(lat, lon) {
    isLoadingWeather.value = true
    try {
      const response = await apiClient.get(
        `forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,precipitation_probability,weather_code&timezone=Asia%2FTaipei&forecast_days=7`,
      )
      selectedLocationForecast.value = response.data.hourly
    } catch (error) {
      console.error('Failed to fetch hourly forecast:', error)
      selectedLocationForecast.value = null
    } finally {
      isLoadingWeather.value = false
    }
  }

  const favoriteCampgroundWeather = ref({})
  const FAVORITE_CACHE_DURATION = 24 * 60 * 60 * 1000

  async function fetchFavoriteCampgroundsWeather(campgrounds) {
    isLoadingWeather.value = true
    const now = Date.now()
    const requests = []
    const result = {}

    for (const camp of campgrounds) {
      if (
        !camp.id ||
        camp.latitude === undefined ||
        camp.longitude === undefined ||
        camp.latitude === null ||
        camp.longitude === null ||
        isNaN(camp.latitude) ||
        isNaN(camp.longitude)
      )
        continue
      const cache = favoriteCampgroundWeather.value[camp.id]
      if (cache && now - cache.timestamp < FAVORITE_CACHE_DURATION) {
        result[camp.id] = cache.weather
      } else {
        requests.push(
          apiClient
            .get(
              `forecast?latitude=${camp.latitude}&longitude=${camp.longitude}&hourly=temperature_2m,precipitation,weather_code&timezone=Asia%2FTaipei&forecast_days=7`,
            )
            .then((response) => {
              const hourly = response.data.hourly
              const days = {}
              for (let i = 0; i < hourly.time.length; i++) {
                const dateObj = new Date(hourly.time[i])
                const dayKey = dateObj.toLocaleDateString('zh-TW', { weekday: 'short' })
                if (!days[dayKey]) days[dayKey] = []
                days[dayKey].push({
                  hour: dateObj.getHours(),
                  temp: Math.round(hourly.temperature_2m[i]),
                  rain: hourly.precipitation[i],
                  icon: getIconForWeatherCode(hourly.weather_code[i]),
                })
              }
              result[camp.id] = days
              favoriteCampgroundWeather.value[camp.id] = {
                weather: days,
                timestamp: Date.now(),
              }
            })
            .catch((error) => {
              console.error(`Failed to fetch hourly weather for favorite camp ${camp.name}:`, error)
              result[camp.id] = {}
            }),
        )
      }
    }
    if (requests.length > 0) {
      await Promise.all(requests)
    }
    isLoadingWeather.value = false
    return result
  }

  return {
    countyWeather,
    townshipWeather,
    selectedLocationForecast,
    isLoadingWeather,
    // 3. 暴露新增的狀態
    isGeoJsonLoading,
    isGeoJsonLoaded,
    // GeoJSON 資料
    taiwanCountyGeoJson,
    taiwanTownshipGeoJson,
    locationCoordsMap,
    setLocationCoordsMap,
    getIconForWeatherCode,
    // Actions
    loadProcessedLocations, // 暴露載入 GeoJSON 的 action
    fetchMultipleLocationWeather,
    fetchOneWeekForecast,
    fetchHourlyForecast,
    // 我的最愛專用
    favoriteCampgroundWeather,
    fetchFavoriteCampgroundsWeather,
  }
})
