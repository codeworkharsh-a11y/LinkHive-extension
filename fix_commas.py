import re

# Fix input.css
with open('s:/Brave Extension/lumilist-extension/input.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Replace commas with spaces in rgb variable values
def replace_rgb_commas(match):
    return match.group(0).replace(',', '')

css = re.sub(r'(--[a-zA-Z0-9-]+-rgb:\s*\d+),\s*(\d+),\s*(\d+)', replace_rgb_commas, css)

with open('s:/Brave Extension/lumilist-extension/input.css', 'w', encoding='utf-8') as f:
    f.write(css)

# Fix script.js
with open('s:/Brave Extension/lumilist-extension/script.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Fix default settings
js = re.sub(r"neonRgb:\s*'34,\s*197,\s*94'", "neonRgb: '34 197 94'", js)

# Fix hexToRgb
js = re.sub(r"return result \? \\$\{parseInt\(result\[1\], 16\)\}, \$\{parseInt\(result\[2\], 16\)\}, \$\{parseInt\(result\[3\], 16\)\}\ : '34, 197, 94';",
            r"return result ? ${parseInt(result[1], 16)}   : '34 197 94';", js)

with open('s:/Brave Extension/lumilist-extension/script.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('Fixed commas.')
