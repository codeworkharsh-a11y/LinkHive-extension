const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const zipName = 'LinkHive-Extension-Release.zip';
const zipPath = path.join(rootDir, zipName);

const itemsToInclude = [
  'manifest.json',
  'newtab.html',
  'script.js',
  'style.css',
  'input.css',
  'background.js',
  'content.js',
  'welcome-canvas.js',
  'supabase.js',
  'supabase-js.min.js',
  'config.js',
  'config.example.js',
  'fonts',
  'icons',
  'Wallpapers'
];

const tempDir = path.join(rootDir, '.temp_dist');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

// Copy files and directories
for (const item of itemsToInclude) {
  const src = path.join(rootDir, item);
  const dest = path.join(tempDir, item);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Zip using PowerShell Compress-Archive
const psCommand = `powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipPath}' -Force"`;
execSync(psCommand, { stdio: 'inherit' });

// Clean up temp directory
fs.rmSync(tempDir, { recursive: true, force: true });

console.log(`Successfully created ${zipName} (${(fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2)} MB)`);
