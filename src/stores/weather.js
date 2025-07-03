// src/stores/weather.js
import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useWeatherStore = defineStore('weather', () => {
  const currentSelectedTime = ref(null) // 用於時間軸的時間點
  const countyWeather = ref({}) // 儲存各縣市天氣數據 { '台北市': { icon: '...', temp: '...' } }

  function setSelectedTime(time) {
    currentSelectedTime.value = time
  }

  function setCountyWeather(data) {
    countyWeather.value = data
  }

  return { currentSelectedTime, countyWeather, setSelectedTime, setCountyWeather }
})