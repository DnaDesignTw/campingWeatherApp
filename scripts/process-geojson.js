import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pointOnFeature from '@turf/point-on-feature'

// 使用 import.meta.url 來獲取當前檔案的目錄
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 檔案路徑
const inputCountyFile = path.join(__dirname, '../public/data/taiwan_cityships_2024.geojson')
const inputTownshipFile = path.join(__dirname, '../public/data/taiwan_townships_2024.geojson')
const outputLocationFile = path.join(__dirname, '../public/data/processed-locations.json')

const processedLocationCoords = []

function processGeoJSON(data, type) {
  if (!data || !data.features) {
    console.error(`Invalid GeoJSON data for type: ${type}`)
    return
  }

  data.features.forEach((feature) => {
    const props = feature.properties
    let featureForCenter = feature
    const name = props.TOWNNAME || props.COUNTYNAME
    const code = props.COUNTYCODE || props.TOWNCODE || name

    if (
      feature.geometry.type === 'MultiPolygon' &&
      ['宜蘭縣', '基隆市', '高雄市', '頭城鎮', '中正區', '旗津區'].includes(name)
    ) {
      let maxArea = 0
      let maxPolygon = null
      feature.geometry.coordinates.forEach((coords) => {
        const poly = {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: coords },
          properties: props,
        }
        const first = coords[0][0]
        const inTaiwan = first[0] > 119.8 && first[0] < 122 && first[1] > 21.8 && first[1] < 25.5
        const area = coords[0].length
        if (inTaiwan && area > maxArea) {
          maxArea = area
          maxPolygon = poly
        }
      })
      if (maxPolygon) featureForCenter = maxPolygon
    }

    const point = pointOnFeature(featureForCenter)
    const center = point.geometry.coordinates

    processedLocationCoords.push({
      lat: center[1],
      lon: center[0],
      type: type,
      name: name,
      code: code,
      county: props.COUNTYNAME || null,
    })
  })
}

async function main() {
  try {
    console.log('--- 開始處理 GeoJSON 檔案 ---')

    const countyData = JSON.parse(fs.readFileSync(inputCountyFile, 'utf8'))
    processGeoJSON(countyData, 'county')
    console.log('縣市數據處理完成。')

    const townshipData = JSON.parse(fs.readFileSync(inputTownshipFile, 'utf8'))
    processGeoJSON(townshipData, 'township')
    console.log('鄉鎮數據處理完成。')

    fs.writeFileSync(outputLocationFile, JSON.stringify(processedLocationCoords, null, 2), 'utf8')
    console.log(`處理後的資料已儲存至 ${outputLocationFile}`)
  } catch (error) {
    console.error('處理過程中發生錯誤:', error)
  }
}

main()
