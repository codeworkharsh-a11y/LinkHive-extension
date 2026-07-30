const fs = require('fs');
const https = require('https');
const path = require('path');

const FONTS_DIR = path.join(__dirname, 'fonts');
const CSS_FILE = path.join(FONTS_DIR, 'fonts.css');

const urls = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
];

async function fetchUrl(url, isFont = false) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    };
    https.get(url, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
        return;
      }
      if (isFont) {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      } else {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }
    }).on('error', reject);
  });
}

async function downloadFonts() {
  if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR);
  let finalCss = '';

  for (let url of urls) {
    console.log(`Fetching CSS: ${url}`);
    let css = await fetchUrl(url);
    const urlRegex = /url\((https:\/\/[^)]+)\)/g;
    let match;
    let fileCount = 0;
    while ((match = urlRegex.exec(css)) !== null) {
      const fontUrl = match[1];
      const filename = `font-${Date.now()}-${fileCount++}.woff2`;
      console.log(`Downloading font: ${fontUrl}`);
      const fontBuffer = await fetchUrl(fontUrl, true);
      fs.writeFileSync(path.join(FONTS_DIR, filename), fontBuffer);
      css = css.replace(fontUrl, `./${filename}`);
    }
    finalCss += css + '\n';
  }

  fs.writeFileSync(CSS_FILE, finalCss);
  console.log('Fonts downloaded and fonts.css generated.');
}

downloadFonts().catch(console.error);
