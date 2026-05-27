import os
import sys

# Ensure backend/src is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

try:
    from src.sandbox import execute_python_in_sandbox
except ImportError as e:
    print("Failed to import execute_python_in_sandbox:", e)
    sys.exit(1)

# Code to run inside the sandbox to verify installations
sandbox_verification_code = """
import os
import subprocess
import sys

print("=== Sandbox Toolchain Verification ===")
print("Python version:", sys.version)

# 1. Check ffmpeg version
try:
    res = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True)
    if res.returncode == 0:
        print("🟢 ffmpeg is available!")
        print(res.stdout.splitlines()[0])
    else:
        print("🔴 ffmpeg error:", res.stderr)
except Exception as e:
    print("🔴 ffmpeg not found:", str(e))

# 2. Check rsvg-convert version
try:
    res = subprocess.run(["rsvg-convert", "--version"], capture_output=True, text=True)
    if res.returncode == 0:
        print("🟢 rsvg-convert is available!")
        print(res.stdout.strip())
    else:
        print("🔴 rsvg-convert error:", res.stderr)
except Exception as e:
    print("🔴 rsvg-convert not found:", str(e))

# 3. Check pdftoppm (poppler-utils)
try:
    res = subprocess.run(["pdftoppm", "-v"], capture_output=True, text=True)
    if res.returncode == 0 or "pdftoppm" in res.stderr:
        print("🟢 pdftoppm (poppler-utils) is available!")
    else:
        print("🔴 pdftoppm error:", res.stderr)
except Exception as e:
    print("🔴 pdftoppm not found:", str(e))

# 4. Try importing major Python libraries
libs = ["pandas", "openpyxl", "docx", "pdfplumber", "matplotlib", "cairosvg", "PIL", "svglib", "pdf2image", "pptx", "moviepy"]
for lib in libs:
    try:
        __import__(lib)
        print(f"🟢 Python library '{lib}' successfully imported!")
    except ImportError as e:
        print(f"🔴 Python library '{lib}' FAILED to import: {str(e)}")

# 5. Try converting a mock SVG to PNG using rsvg-convert
svg_content = '<svg width="100" height="100"><rect width="100" height="100" style="fill:rgb(0,0,255);stroke-width:10;stroke:rgb(0,0,0)" /></svg>'
with open("test_mock.svg", "w") as f:
    f.write(svg_content)

try:
    res = subprocess.run(["rsvg-convert", "-o", "test_mock.png", "test_mock.svg"], capture_output=True, text=True)
    if res.returncode == 0 and os.path.exists("test_mock.png"):
        print("🟢 SVG to PNG conversion test PASSED!")
    else:
        print("🔴 SVG to PNG conversion test FAILED:", res.stderr)
except Exception as e:
    print("🔴 SVG to PNG conversion test EXCEPTION:", str(e))
"""

print("🚀 Launching sandbox validation test...")
result = execute_python_in_sandbox(sandbox_verification_code)
print(result)
