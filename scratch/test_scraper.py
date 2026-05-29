import httpx
from html.parser import HTMLParser

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

def test_scrape():
    url = "https://mp.weixin.qq.com/s/V68L_e_H0Ld7M6s2U67W4g"
    print(f"Fetching: {url}")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = httpx.get(url, headers=headers, timeout=15.0)
        print(f"Response status: {response.status_code}")
        
        parser = GenericWebpageParser()
        html_content = response.content.decode(response.encoding or 'utf-8', errors='ignore')
        parser.feed(html_content)
        parsed_text = parser.get_text()
        
        with open("scratch/parsed.txt", "w", encoding="utf-8") as f:
            f.write(parsed_text)
            
        print("\n--- Parsed Text Info ---")
        print(f"Length of text: {len(parsed_text)} chars")
        print("Written to scratch/parsed.txt")
        
        if len(parsed_text) > 10:
            print("SUCCESS: Text extracted successfully!")
        else:
            print("FAILED: Text length too short.")
            
    except Exception as e:
        print(f"Error fetching/parsing: {e}")

if __name__ == "__main__":
    test_scrape()
