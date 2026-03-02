import sharp from 'sharp';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ICONS_DIR = join(ROOT, 'public', 'icons');
const SPLASH_DIR = join(ROOT, 'public', 'splash');
const SOURCE_PATH = join(ROOT, 'public', 'icons', 'icon-512x512.png');
const BG_COLOR = { r: 18, g: 8, b: 38 }; // #120826

// Read source into buffer to avoid same-file input/output conflict
const SOURCE_BUFFER = readFileSync(SOURCE_PATH);

// Ensure output dirs exist
[ICONS_DIR, SPLASH_DIR].forEach(d => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); });

// --- Icon sizes ---
const ICON_SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

async function generateIcons() {
  for (const size of ICON_SIZES) {
    const outPath = join(ICONS_DIR, `icon-${size}x${size}.png`);
    await sharp(SOURCE_BUFFER).resize(size, size).png().toFile(outPath);
    console.log(`  icon ${size}x${size}`);
  }
}

async function generateMaskableIcons() {
  // Maskable icons need the logo at ~70% with padding for safe zone
  for (const size of ICON_SIZES) {
    const logoSize = Math.round(size * 0.7);
    const padding = Math.round((size - logoSize) / 2);

    const resizedLogo = await sharp(SOURCE_BUFFER).resize(logoSize, logoSize).png().toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { ...BG_COLOR, alpha: 1 },
      },
    })
      .composite([{ input: resizedLogo, left: padding, top: padding }])
      .png()
      .toFile(join(ICONS_DIR, `icon-maskable-${size}x${size}.png`));

    console.log(`  maskable ${size}x${size}`);
  }
}

// --- Splash screens ---
// Format: { name, width, height } — physical pixels for each device
const SPLASH_SCREENS = [
  { name: 'iphone-15-pro-max',  width: 1290, height: 2796 },
  { name: 'iphone-15-pro',      width: 1179, height: 2556 },
  { name: 'iphone-14',          width: 1170, height: 2532 },
  { name: 'iphone-se',          width: 750,  height: 1334 },
  { name: 'ipad-pro-12',        width: 2048, height: 2732 },
  { name: 'ipad-air',           width: 1640, height: 2360 },
];

async function generateSplashScreens() {
  for (const screen of SPLASH_SCREENS) {
    // Logo at ~25% of the shortest dimension
    const logoSize = Math.round(Math.min(screen.width, screen.height) * 0.25);
    const left = Math.round((screen.width - logoSize) / 2);
    const top = Math.round((screen.height - logoSize) / 2);

    const resizedLogo = await sharp(SOURCE_BUFFER).resize(logoSize, logoSize).png().toBuffer();

    await sharp({
      create: {
        width: screen.width,
        height: screen.height,
        channels: 4,
        background: { ...BG_COLOR, alpha: 1 },
      },
    })
      .composite([{ input: resizedLogo, left, top }])
      .png()
      .toFile(join(SPLASH_DIR, `${screen.name}.png`));

    console.log(`  splash ${screen.name} (${screen.width}x${screen.height})`);
  }
}

// --- Run ---
console.log('Generating PWA icons...');
await generateIcons();
console.log('\nGenerating maskable icons...');
await generateMaskableIcons();
console.log('\nGenerating iOS splash screens...');
await generateSplashScreens();
console.log('\nDone!');
