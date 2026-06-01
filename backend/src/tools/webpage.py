import requests
from html.parser import HTMLParser
from langchain_core.tools import tool

class GenericWebpageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_body = False
        self.in_js_content = False
        self.js_content_div_count = 0
        self.ignored_depth = 0
        self.js_content_parts = []
        self.body_parts = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        
        if tag == "body":
            self.in_body = True
            
        if tag in ("script", "style"):
            self.ignored_depth += 1
            return
            
        if tag == "div" and attrs_dict.get("id") == "js_content":
            self.in_js_content = True
            self.js_content_div_count = 1
            return
            
        if self.in_js_content:
            if tag == "div":
                self.js_content_div_count += 1
            elif tag in ("p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li"):
                self.js_content_parts.append("\n")
                
        if self.in_body and not self.in_js_content:
            if tag in ("p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li", "div"):
                self.body_parts.append("\n")

    def handle_endtag(self, tag):
        if tag == "body":
            self.in_body = False
            
        if tag in ("script", "style"):
            self.ignored_depth = max(0, self.ignored_depth - 1)
            return
            
        if self.in_js_content:
            if tag == "div":
                self.js_content_div_count -= 1
                if self.js_content_div_count == 0:
                    self.in_js_content = False

    def handle_data(self, data):
        if self.ignored_depth > 0:
            return
            
        text = data.strip()
        if not text:
            return
            
        if self.in_js_content:
            self.js_content_parts.append(text + " ")
        elif self.in_body:
            self.body_parts.append(text + " ")

    def get_text(self) -> str:
        if self.js_content_parts:
            full_text = "".join(self.js_content_parts)
        else:
            full_text = "".join(self.body_parts)
            
        lines = [line.strip() for line in full_text.split("\n")]
        return "\n".join([line for line in lines if line])


@tool
def fetch_webpage(url: str) -> str:
    """直接爬取、解析并提取任意公开网页或微信公众号文章的正文文本内容。
    
    当用户在聊天中发来任何网页链接（如 mp.weixin.qq.com 微信公众号链接或其他新闻、博客、文章链接），
    且你需要阅读、分析、概括该网页的核心内容时，必须调用此工具以获取该网页的完整纯文本。
    
    Args:
        url: 需要获取正文的网页绝对 URL 链接（如 'https://mp.weixin.qq.com/s/xxxxxx'）。
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        response = requests.get(url, headers=headers, timeout=15.0)
        if response.status_code != 200:
            return f"获取网页失败，HTTP 状态码: {response.status_code}"
            
        parser = GenericWebpageParser()
        html_content = response.content.decode(response.encoding or 'utf-8', errors='ignore')
        parser.feed(html_content)
        parsed_text = parser.get_text()
        
        if not parsed_text:
            return "网页请求成功，但未能解析出有效的正文文本。"
            
        return parsed_text
        
    except Exception as e:
        return f"抓取网页发生异常: {str(e)}"
