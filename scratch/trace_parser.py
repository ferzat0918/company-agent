import httpx
from html.parser import HTMLParser

class TraceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_body = False
        self.tag_stack = []
        self.ignore_tags = {"script", "style", "head", "title", "meta", "link"}
        self.captured = []

    def handle_starttag(self, tag, attrs):
        self.tag_stack.append(tag)
        if tag == "body":
            self.in_body = True
            print("--- ENTERED BODY ---")
        
    def handle_endtag(self, tag):
        if self.tag_stack:
            self.tag_stack.pop()
        if tag == "body":
            self.in_body = False
            print("--- EXITED BODY ---")

    def handle_data(self, data):
        if not self.in_body:
            return
        if any(ignored in self.tag_stack for ignored in self.ignore_tags):
            return
        text = data.strip()
        if text:
            self.captured.append(text)
            print(f"Captured inside {self.tag_stack}: {text[:40]}")

with open("scratch/response.html", "r", encoding="utf-8") as f:
    html = f.read()

parser = TraceParser()
parser.feed(html)
print("Total captured segments:", len(parser.captured))
