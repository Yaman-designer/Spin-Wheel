import base64
import os
import re
from django.conf import settings
import logging
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs

logger = logging.getLogger(__name__)

def image_to_base64(image_path):
    if not image_path:
        raise ValueError("Image path is empty or not provided.")

    if image_path.startswith('http://') or image_path.startswith('https://'):
        # Download the image from the URL
        try:
            response = requests.get(image_path)
            response.raise_for_status()
            img_str = base64.b64encode(response.content).decode('utf-8')
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Error downloading image from '{image_path}': {e}")
    else:
        # Construct the full path to the image
        full_image_path = os.path.join(settings.BASE_DIR, "apps", "promotion", image_path)

        # Check if the constructed path is a file
        if not os.path.isfile(full_image_path):
            raise FileNotFoundError(f"File '{full_image_path}' not found.")

        try:
            with open(full_image_path, 'rb') as image_file:
                img_str = base64.b64encode(image_file.read()).decode('utf-8')
        except Exception as e:
            raise RuntimeError(f"Error converting '{full_image_path}' to base64: {e}")

    return img_str

def check_script(url: str) -> bool:
    """Check if wheelluck-script is present on the given URL."""
    url = url.strip()
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    try:
        # Try HTTPS first, fallback to HTTP if it fails
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
        except requests.exceptions.RequestException:
            if url.startswith('https://'):
                url = url.replace('https://', 'http://', 1)
                response = requests.get(url, timeout=10)
                response.raise_for_status()
            else:
                raise

        soup = BeautifulSoup(response.text, 'html.parser')
        
        for script in soup.find_all('script'):
            # Check script ID
            if script.get('id', '').strip() == 'wheelluck-script':
                return True
            
            # Check script content
            content = (script.string or '').lower()
            if 'wheelluck-script' in content or 'widget.js' in content:
                return True

            # Check script src
            src = (script.get('src') or '').lower()
            if 'wheelluck' in src or 'widget.js' in src:
                return True
        
        return False

    except requests.exceptions.RequestException as e:
        raise Exception(f"Error occurred while fetching the webpage: {e}")
    
def update_wheel_colors(wheel_svg, colors):
  
    wheel_svg = re.sub(r'--primary-color: #[0-9a-fA-F]{6};', f'--primary-color: {colors["container"]["background"]};', wheel_svg)
    wheel_svg = re.sub(r'--secondary-color: #[0-9a-fA-F]{6};', f'--secondary-color: {colors["circle"]["text"]};', wheel_svg)
    wheel_svg = re.sub(r'--background-color: #[0-9a-fA-F]{6};', f'--background-color: {colors["circle"]["background"]};', wheel_svg)
    wheel_svg = re.sub(r'--slice-color-1: #[0-9a-fA-F]{6};', f'--slice-color-1: {colors["slice_1"]["background"]};', wheel_svg)
    wheel_svg = re.sub(r'--slice-color-2: #[0-9a-fA-F]{6};', f'--slice-color-2: {colors["slice_2"]["background"]};', wheel_svg)
    wheel_svg = re.sub(r'--slice-color-3: #[0-9a-fA-F]{6};', f'--slice-color-3: {colors["slice_3"]["background"]};', wheel_svg)
    wheel_svg = re.sub(r'--slice-color-4: #[0-9a-fA-F]{6};', f'--slice-color-4: {colors["slice_4"]["background"]};', wheel_svg)
    wheel_svg = re.sub(r'--pin-color-1: #[0-9a-fA-F]{6};', f'--pin-color-1: {colors["pin"]["background"]};', wheel_svg)
    wheel_svg = re.sub(r'--pin-color-2: #[0-9a-fA-F]{6};', f'--pin-color-2: {colors["pin"]["text"]};', wheel_svg)
   # Text renklerini indekslere göre güncelle
    text_color_indices = {
        0: colors["slice_1"]["text"],
        10: colors["slice_1"]["text"],
        8: colors["slice_1"]["text"],
        1: colors["slice_2"]["text"],
        3: colors["slice_2"]["text"],
        5: colors["slice_2"]["text"],
        11: colors["slice_3"]["text"],
        9: colors["slice_3"]["text"],
        7: colors["slice_3"]["text"],
        2: colors["slice_4"]["text"],
        4: colors["slice_4"]["text"],
        6: colors["slice_4"]["text"]
    }

    # Belirli text indeksleri için fill özelliğini güncelle
    matches = list(re.finditer(r'(<text class="cls-3 wheelText"[^>]*>[^<]*<\/text>)', wheel_svg))
    
    for idx, text_color in text_color_indices.items():
        if 0 <= idx < len(matches):
            text_element = matches[idx].group(0)
            # fill değerini inline olarak ayarlayın
            updated_text = re.sub(r'(<text class="cls-3 wheelText")', rf'\1 style="fill: {text_color};"', text_element)
            wheel_svg = wheel_svg.replace(text_element, updated_text)
    
    return wheel_svg
