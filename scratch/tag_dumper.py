with open("scratch/response.html", "r", encoding="utf-8") as f:
    html = f.read()

from html.parser import HTMLParser

class TagDumper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.count = 0

    def handle_starttag(self, tag, attrs):
        self.count += 1
        if self.count < 60:
            print(f"START: {tag} ({dict(attrs).get('id', '')})")

    def handle_endtag(self, tag):
        if self.count < 60:
            print(f"END: {tag}")

parser = TagDumper()
try:
    parser.feed(html)
except Exception as e:
    print("Error:", e)
