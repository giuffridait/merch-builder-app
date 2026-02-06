import { Icon } from './icons';

export interface DesignVariant {
  id: string;
  name: string;
  style: string;
  svg: string;
  score: number;
  reasoning: string;
}

export interface GeneratedDesigns {
  variants: DesignVariant[];
  recommended: string;
}

function generateMinimalSVG(text: string, icon: Icon): string {
  return `
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <text x="200" y="180" font-family="'Helvetica Neue', sans-serif" font-size="48" font-weight="700" text-anchor="middle" fill="currentColor" letter-spacing="-1">
        ${text.toUpperCase()}
      </text>
      <g transform="translate(200, 240)">
        <path d="${icon.path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(-12, -12) scale(1.5)" />
      </g>
    </svg>
  `;
}

function generateBoldSVG(text: string, icon: Icon): string {
  return `
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(200, 140)">
        <path d="${icon.path}" fill="currentColor" transform="translate(-12, -12) scale(4)" opacity="0.9" />
      </g>
      <text x="200" y="280" font-family="'Impact', sans-serif" font-size="56" font-weight="900" text-anchor="middle" fill="currentColor" letter-spacing="2">
        ${text.toUpperCase()}
      </text>
      <line x1="80" y1="300" x2="320" y2="300" stroke="currentColor" stroke-width="4" />
    </svg>
  `;
}

function generateRetroSVG(text: string, icon: Icon): string {
  return `
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" stroke-width="6" />
      <circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5,5" />
      <g transform="translate(200, 150)">
        <path d="${icon.path}" fill="currentColor" transform="translate(-12, -12) scale(2.5)" />
      </g>
      <path id="curve" d="M 80,240 Q 200,280 320,240" fill="none" />
      <text font-family="'Georgia', serif" font-size="38" font-weight="700" fill="currentColor" letter-spacing="1">
        <textPath href="#curve" startOffset="50%" text-anchor="middle">
          ${text.toUpperCase()}
        </textPath>
      </text>
    </svg>
  `;
}

export function generateVariants(
  text: string,
  icon: Icon,
  vibe?: string,
  occasion?: string
): GeneratedDesigns {
  const variants: DesignVariant[] = [
    {
      id: 'A',
      name: 'Minimal',
      style: 'Text-focused with subtle accent',
      svg: generateMinimalSVG(text, icon),
      score: vibe === 'minimal' ? 95 : 75,
      reasoning: 'Clean composition with restrained icon placement. Perfect for understated elegance.'
    },
    {
      id: 'B',
      name: 'Bold',
      style: 'Statement piece with large elements',
      svg: generateBoldSVG(text, icon),
      score: vibe === 'bold' || vibe === 'sporty' ? 95 : 70,
      reasoning: 'Maximum impact through scale and contrast. Commands attention and makes a statement.'
    },
    {
      id: 'C',
      name: 'Retro Badge',
      style: 'Vintage-inspired composition',
      svg: generateRetroSVG(text, icon),
      score: vibe === 'retro' || vibe === 'cute' ? 95 : 80,
      reasoning: 'Nostalgic aesthetic with circular framing. Timeless appeal with vintage charm.'
    }
  ];

  // Sort by score
  variants.sort((a, b) => b.score - a.score);

  return {
    variants,
    recommended: variants[0].id
  };
}

export function getContrastColor(bgHex: string): string {
  const hex = bgHex.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a1a' : '#f5f5f5';
}
