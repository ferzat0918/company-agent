import os
from PIL import Image

src_dir = r"c:\Users\lenovo\company-agent\产品描述"
assets_dir = r"c:\Users\lenovo\company-agent\skills\product-handbook\assets"
ref_dir = r"c:\Users\lenovo\company-agent\skills\product-handbook\references"

# Ensure directories exist
os.makedirs(assets_dir, exist_ok=True)
os.makedirs(ref_dir, exist_ok=True)

files = os.listdir(src_dir)
print(f"Found {len(files)} files in source directory.")

for filename in files:
    if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        continue
    
    src_path = os.path.join(src_dir, filename)
    base_name, _ = os.path.splitext(filename)
    dest_filename = f"{base_name}.jpg"
    dest_path = os.path.join(assets_dir, dest_filename)
    
    try:
        with Image.open(src_path) as img:
            # If in RGBA mode, convert to RGB for JPEG compatibility
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                # Create a white background
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
                
            orig_width, orig_height = img.size
            max_dim = 2048
            
            # Resize if necessary
            if orig_width > max_dim or orig_height > max_dim:
                if orig_width > orig_height:
                    new_width = max_dim
                    new_height = int(orig_height * (max_dim / orig_width))
                else:
                    new_height = max_dim
                    new_width = int(orig_width * (max_dim / orig_height))
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                print(f"Resized '{filename}' from {orig_width}x{orig_height} to {new_width}x{new_height}")
            else:
                print(f"Kept size for '{filename}': {orig_width}x{orig_height}")
                
            # Save as JPEG
            img.save(dest_path, 'JPEG', quality=85)
            orig_size = os.path.getsize(src_path)
            dest_size = os.path.getsize(dest_path)
            print(f"Converted and compressed: {filename} ({orig_size / 1024 / 1024:.2f} MB) -> {dest_filename} ({dest_size / 1024 / 1024:.2f} MB)")
            
    except Exception as e:
        print(f"Failed to process {filename}: {e}")

print("Image processing complete!")
