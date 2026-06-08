import os
import uuid
import requests
from langchain_core.tools import tool
from langchain_core.runnables.config import var_child_runnable_config
from src.config import GPT_API_KEY, GPT_BASE_URL

# UMX 品牌视觉锚点 — 当 style="umx-futurism" 时自动注入到 prompt 前缀
_UMX_STYLE_PREFIX = (
    "Futuristic cyber-punk aesthetics with retro-futurism influence. "
    "Sleek dark mode design on stealth black #0A0A0A background. "
    "Accent colors: neon green #DAFC08 and vivid purple #7201FF. "
    "Matte sandblasted aerospace-grade aluminum texture, "
    "glassmorphism panels with frosted blur effect, "
    "strong geometric grid layout (5x9 or 9x5), "
    "backlighting with sharp shadows and metallic rim light, "
    "uppercase typography with tight line height, "
    "cold mechanical structure meets emotional light field. "
    "Premium, minimal, and uncompromising. "
)

# 允许的尺寸列表
_VALID_SIZES = {"1024x1024", "1536x1024", "1024x1536", "auto"}


@tool
def draw_image(prompt: str, size: str = "1024x1024", style: str = "auto") -> str:
    """当你（或者子部门 Agent）需要根据文字描述生成、画制或创作任何图片、插画、Logo、海报等视觉内容时调用此工具。
    
    该工具会将你的描述发送至 GPT 顶尖图像生成模型（image2 ）完成创作，并自动将成品图保存至当前会话的物理工作区。
    
    Args:
        prompt: 对图片内容极其细致且富有艺术色彩的详细描述。
        size: 图片尺寸。可选值：
            - "1024x1024"（默认，正方形）
            - "1536x1024"（横版，适合海报/Banner）
            - "1024x1536"（竖版，适合手机壁纸/竖版海报）
            - "auto"（等同于 1024x1024）
        style: 风格预设。可选值：
            - "auto"（默认，不注入额外风格词）
            - "umx-futurism"（自动注入 UMX 品牌视觉锚点词：暗色调、霓虹强调色、铝合金质感、赛博朋克风格等）
            - "natural"（自然风格，不注入额外风格词）
    """
    if not GPT_API_KEY:
        return "错误：未配置生图 API 秘钥 (GPT_API_KEY)，请联系系统管理员在 .env 中配置。"
        
    try:
        config = var_child_runnable_config.get()
        thread_id = "default"
        if config and isinstance(config, dict):
            thread_id = config.get("configurable", {}).get("thread_id", "default")
    except Exception:
        thread_id = "default"

    # 规范化尺寸参数
    if size not in _VALID_SIZES:
        size = "1024x1024"
    if size == "auto":
        size = "1024x1024"

    # 风格注入：当选择 umx-futurism 时，自动在用户 prompt 前注入品牌视觉锚点
    final_prompt = prompt
    if style == "umx-futurism":
        final_prompt = _UMX_STYLE_PREFIX + prompt
        
    print(f"[Image Generator] Received draw task for thread [{thread_id}]. Size: {size}, Style: {style}. Prompt: {prompt}")

    headers = {
        "Authorization": f"Bearer {GPT_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "gpt-image-2",
        "prompt": final_prompt,
        "n": 1,
        "size": size
    }

    try:
        url = f"{GPT_BASE_URL.rstrip('/')}/images/generations"
        response = requests.post(url, json=payload, headers=headers, timeout=180)
        response.raise_for_status()
        
        res_data = response.json()
        data_list = res_data.get("data", [])
        if not data_list:
            raise KeyError(f"返回数据中的 'data' 字段为空: {res_data}")
            
        first_item = data_list[0]
        image_url = None
        is_base64 = False
        
        if isinstance(first_item, str):
            image_url = first_item
        elif isinstance(first_item, dict):
            for key in ["url", "URL", "uri", "URI", "link", "b64_json"]:
                if key in first_item:
                    image_url = first_item[key]
                    if key == "b64_json":
                        is_base64 = True
                    break
            
            if not image_url:
                for val in first_item.values():
                    if isinstance(val, str) and val.startswith(("http://", "https://")):
                        image_url = val
                        break
                        
        if not image_url:
            raise KeyError(f"无法从返回数据中识别出有效的图片资源！返回的第一项为: {first_item}")

        img_data = None
        if is_base64 or (isinstance(image_url, str) and not image_url.startswith(("http://", "https://"))):
            import base64
            base64_str = str(image_url)
            if "," in base64_str:
                base64_str = base64_str.split(",", 1)[1]
            img_data = base64.b64decode(base64_str)
        else:
            img_response = requests.get(image_url, timeout=90)
            img_response.raise_for_status()
            img_data = img_response.content
        
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        workspace_dir = os.path.join(project_root, "workspace", thread_id)
        os.makedirs(workspace_dir, exist_ok=True)
        
        filename = f"art_{uuid.uuid4().hex[:8]}.png"
        dest_filepath = os.path.join(workspace_dir, filename)
        
        with open(dest_filepath, "wb") as f:
            f.write(img_data)
            
        print(f"[Image Generator] Successfully downloaded and saved image to: {dest_filepath}")
        
        return (
            f"✓ 图像已成功生成！文件已安全同步至您的工作区。\n\n"
            f"![{filename}](/workspace/{thread_id}/{filename})"
        )
        
    except Exception as e:
        error_detail = ""
        try:
            if 'response' in locals() and response is not None and hasattr(response, 'text'):
                error_detail = f"\n中转站详细返回: {response.text}"
        except Exception:
            pass
        print(f"[Image Generator] Error during generation: {str(e)}{error_detail}")
        return f"⚠ 图像生成过程中发生网络或API交互错误，生成失败: {str(e)}{error_detail}"
