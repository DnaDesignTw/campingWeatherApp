import json
import requests
import time

# 讀取原始 JSON
with open('d:\\DANIEL\\camping-weather-app\\src\\data\\campgrounds.json', 'r', encoding='utf-8') as f:
    campgrounds = json.load(f)

def get_altitude(lat, lon):
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        # Open-Meteo elevation API 回傳格式: { "elevation": [value] }
        elev = data.get("elevation")
        if isinstance(elev, list) and len(elev) > 0:
            return elev[0]
        return None
    except Exception as e:
        print(f"Error for {lat},{lon}: {e}")
        return None

for camp in campgrounds:
    lat = camp.get("latitude")
    lon = camp.get("longitude")
    if lat is not None and lon is not None:
        camp["altitude"] = get_altitude(lat, lon)
        time.sleep(0.5)  # API 請求間隔，避免被封鎖

# 寫回 JSON
total = len(campgrounds)
for idx, camp in enumerate(campgrounds, 1):
    lat = camp.get("latitude")
    lon = camp.get("longitude")
    if lat is not None and lon is not None:
        camp["altitude"] = get_altitude(lat, lon)
    print(f"[{idx}/{total}] {camp.get('name','')} altitude: {camp.get('altitude')}")
    time.sleep(0.5)  # API 請求間隔，避免被封鎖

# 寫回新 JSON 檔
with open('d:\\DANIEL\\camping-weather-app\\src\\data\\campgrounds-new.json', 'w', encoding='utf-8') as f:
    json.dump(campgrounds, f, ensure_ascii=False, indent=4)
    json.dump(campgrounds, f, ensure_ascii=False, indent=4)