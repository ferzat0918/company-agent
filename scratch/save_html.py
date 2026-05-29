import httpx

url = "https://mp.weixin.qq.com/s/V68L_e_H0Ld7M6s2U67W4g"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
response = httpx.get(url, headers=headers)
with open("scratch/response.html", "w", encoding="utf-8") as f:
    f.write(response.text)
print("Saved html to scratch/response.html, length:", len(response.text))
