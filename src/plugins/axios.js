// src/plugins/axios.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.open-meteo.com/v1/', // Open-Meteo 的基礎 URL
  timeout: 10000, // 請求超時時間
  headers: {
    'Content-Type': 'application/json',
  },
});

// 你可以添加請求或響應攔截器
// apiClient.interceptors.request.use(config => {
//   // 在這裡處理請求前的邏輯，例如添加 token
//   return config;
// });

// apiClient.interceptors.response.use(response => {
//   // 在這裡處理響應後的邏ogic
//   return response;
// }, error => {
//   // 在這裡處理錯誤
//   return Promise.reject(error);
// });

export default apiClient;