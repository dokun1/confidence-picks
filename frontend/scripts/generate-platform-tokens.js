#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKENS_DIR = path.join(__dirname, '../src/designsystem/tokens');
const PLATFORM_TOKENS_DIR = path.join(__dirname, '../src/designsystem/platform-tokens');

async function loadTokens() {
  const tokens = {};
  
  try {
    const files = await fs.readdir(TOKENS_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    for (const file of jsonFiles) {
      const filePath = path.join(TOKENS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const tokenName = path.basename(file, '.json');
      tokens[tokenName] = JSON.parse(content);
    }
    
    return tokens;
  } catch (error) {
    console.error('Error loading tokens:', error);
    throw error;
  }
}

function transformColorsForTailwind(colorTokens) {
  const colors = {};
  
  if (colorTokens?.color) {
    Object.entries(colorTokens.color).forEach(([colorName, shades]) => {
      if (typeof shades === 'object' && shades !== null) {
        colors[colorName] = {};
        Object.entries(shades).forEach(([shade, value]) => {
          colors[colorName][shade] = value;
        });
      }
    });
  }
  
  return colors;
}

function transformSpacingForTailwind(spacingTokens) {
  const spacing = {};
  
  if (spacingTokens?.spacing) {
    Object.entries(spacingTokens.spacing).forEach(([key, value]) => {
      spacing[key] = `${value}px`;
    });
  }
  
  if (spacingTokens?.layout) {
    Object.entries(spacingTokens.layout).forEach(([key, value]) => {
      spacing[`layout-${key}`] = `${value}px`;
    });
  }
  
  return spacing;
}

function transformTypographyForTailwind(typographyTokens) {
  const result = {};
  
  if (typographyTokens?.typography) {
    const { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing } = typographyTokens.typography;
    
    if (fontFamily) {
      result.fontFamily = fontFamily;
    }
    
    if (fontSize) {
      result.fontSize = {};
      Object.entries(fontSize).forEach(([key, value]) => {
        result.fontSize[key] = `${value}px`;
      });
    }
    
    if (fontWeight) {
      result.fontWeight = fontWeight;
    }
    
    if (lineHeight) {
      result.lineHeight = lineHeight;
    }
    
    if (letterSpacing) {
      result.letterSpacing = {};
      Object.entries(letterSpacing).forEach(([key, value]) => {
        result.letterSpacing[key] = `${value}em`;
      });
    }
  }
  
  return result;
}

function transformAnimationForTailwind(animationTokens) {
  const result = {};
  
  if (animationTokens?.animation) {
    const { duration, easing } = animationTokens.animation;
    
    if (duration) {
      result.transitionDuration = {};
      Object.entries(duration).forEach(([key, value]) => {
        result.transitionDuration[key] = `${value}ms`;
      });
    }
    
    if (easing) {
      result.transitionTimingFunction = easing;
    }
  }
  
  return result;
}

function transformBorderForTailwind(borderTokens) {
  const result = {};
  
  if (borderTokens?.border) {
    const { radius, width } = borderTokens.border;
    
    if (radius) {
      result.borderRadius = {};
      Object.entries(radius).forEach(([key, value]) => {
        result.borderRadius[key] = `${value}px`;
      });
    }
    
    if (width) {
      result.borderWidth = {};
      Object.entries(width).forEach(([key, value]) => {
        result.borderWidth[key] = `${value}px`;
      });
    }
  }
  
  if (borderTokens?.shadow) {
    result.boxShadow = {};
    Object.entries(borderTokens.shadow).forEach(([key, value]) => {
      result.boxShadow[key] = value;
    });
  }
  
  return result;
}

function transformIconsForTailwind(iconTokens) {
  const result = {};
  
  if (iconTokens?.iconSize) {
    result.width = {};
    result.height = {};
    Object.entries(iconTokens.iconSize).forEach(([key, value]) => {
      const iconKey = `icon-${key}`;
      result.width[iconKey] = `${value}px`;
      result.height[iconKey] = `${value}px`;
    });
  }
  
  return result;
}

async function generateTailwindConfig(tokens) {
  const config = {
    content: [
      './src/**/*.{html,js,svelte,ts}',
      './src/designsystem/components/**/*.svelte'
    ],
    theme: {
      extend: {}
    },
    plugins: ['@tailwindcss/typography']
  };
  
  // Transform each token type
  if (tokens.color) {
    const colors = transformColorsForTailwind(tokens.color);
    if (Object.keys(colors).length > 0) {
      config.theme.extend.colors = colors;
    }
  }
  
  if (tokens.spacing) {
    const spacing = transformSpacingForTailwind(tokens.spacing);
    if (Object.keys(spacing).length > 0) {
      config.theme.extend.spacing = spacing;
    }
  }
  
  if (tokens.typography) {
    const typography = transformTypographyForTailwind(tokens.typography);
    Object.assign(config.theme.extend, typography);
  }
  
  if (tokens.animation) {
    const animation = transformAnimationForTailwind(tokens.animation);
    Object.assign(config.theme.extend, animation);
  }
  
  if (tokens.border) {
    const border = transformBorderForTailwind(tokens.border);
    Object.assign(config.theme.extend, border);
  }
  
  if (tokens.icon) {
    const icon = transformIconsForTailwind(tokens.icon);
    Object.assign(config.theme.extend, icon);
  }
  
  return config;
}

async function generateIconMap(tokens) {
  if (!tokens.icon?.icon) return {};
  
  const iconMap = {};
  
  Object.entries(tokens.icon.icon).forEach(([category, icons]) => {
    Object.entries(icons).forEach(([name, heroiconName]) => {
      iconMap[`${category}-${name}`] = heroiconName;
    });
  });
  
  return iconMap;
}

async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function generatePlatformTokens() {
  console.log('🔄 Generating platform tokens...');
  
  try {
    // Load all token files
    const tokens = await loadTokens();
    
    // Ensure platform-tokens directory exists
    await ensureDirectoryExists(PLATFORM_TOKENS_DIR);
    
    // Generate Tailwind config
    const tailwindConfig = await generateTailwindConfig(tokens);
    const tailwindConfigContent = `/** @type {import('tailwindcss').Config} */\nexport default ${JSON.stringify(tailwindConfig, null, 2)};`;
    
    await fs.writeFile(
      path.join(PLATFORM_TOKENS_DIR, 'tailwind.config.js'),
      tailwindConfigContent
    );
    
    // Generate icon map
    const iconMap = await generateIconMap(tokens);
    const iconMapContent = `// Auto-generated icon mapping from design tokens\nexport const iconMap = ${JSON.stringify(iconMap, null, 2)};`;
    
    await fs.writeFile(
      path.join(PLATFORM_TOKENS_DIR, 'icons.js'),
      iconMapContent
    );
    
    // Generate summary file
    const summary = {
      generatedAt: new Date().toISOString(),
      tokenFiles: Object.keys(tokens),
      tailwindExtensions: Object.keys(tailwindConfig.theme.extend),
      iconCount: Object.keys(iconMap).length
    };
    
    await fs.writeFile(
      path.join(PLATFORM_TOKENS_DIR, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    console.log('✅ Platform tokens generated successfully!');
    console.log(`   - Tailwind config with ${Object.keys(tailwindConfig.theme.extend).length} extensions`);
    console.log(`   - Icon map with ${Object.keys(iconMap).length} icons`);
    console.log(`   - Generated from ${Object.keys(tokens).length} token files`);
    
  } catch (error) {
    console.error('❌ Error generating platform tokens:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generatePlatformTokens().catch(console.error);
}

export { generatePlatformTokens };
