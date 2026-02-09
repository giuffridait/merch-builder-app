import { chatCompletion } from '@/lib/llm';
import { Icon, ICON_LIBRARY } from '@/lib/icons';
import { DesignVariant } from '@/lib/design';

// ── Semantic Design Schema ─────────────────────────────────────────────────────
// The LLM picks from a small vocabulary of tokens. The renderer maps them to SVG.

export interface SemanticDesign {
  name: string;
  style: string;
  reasoning: string;
  composition: 'stacked' | 'badge' | 'split' | 'overlay' | 'minimal' | 'banner';
  textSize: 'small' | 'medium' | 'large';
  textStyle: 'light' | 'regular' | 'bold' | 'heavy';
  font: 'sans' | 'serif' | 'display';
  uppercase: boolean;
  iconPosition: 'above' | 'below' | 'left' | 'right' | 'behind' | 'none';
  iconSize: 'small' | 'medium' | 'large';
  iconFilled: boolean;
  border: 'none' | 'underline' | 'circle' | 'double-circle' | 'box' | 'dots';
}

// ── Renderer: Semantic → SVG ───────────────────────────────────────────────────

const FONT_MAP = {
  sans: "'Helvetica Neue', sans-serif",
  serif: "'Georgia', serif",
  display: "'Impact', sans-serif"
};

const TEXT_SIZE_MAP = { small: 32, medium: 44, large: 58 };
const TEXT_WEIGHT_MAP = { light: 300, regular: 400, bold: 700, heavy: 900 };
const ICON_SCALE_MAP = { small: 1.5, medium: 2.5, large: 4 };

function renderSemanticToSVG(design: SemanticDesign, text: string, icon: Icon | null): string {
  const parts: string[] = ['<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">'];

  const fontSize = TEXT_SIZE_MAP[design.textSize];
  const fontWeight = TEXT_WEIGHT_MAP[design.textStyle];
  const fontFamily = FONT_MAP[design.font];
  const displayText = design.uppercase ? text.toUpperCase() : text;
  const hasIcon = !!icon?.path && design.iconPosition !== 'none';
  const iconScale = ICON_SCALE_MAP[design.iconSize];
  const iconOffset = -12; // Icon paths are 24x24, center is at 12,12

  // Compute layout positions based on composition
  let textX = 200, textY = 200;
  let iconX = 200, iconY = 200;

  switch (design.composition) {
    case 'stacked':
      // Icon above or below text, centered
      if (hasIcon && design.iconPosition === 'below') {
        textY = 160;
        iconY = 240;
      } else if (hasIcon) {
        // Default: icon above
        iconY = 130;
        textY = 230;
      } else {
        textY = 210;
      }
      break;

    case 'badge':
      // Centered with icon above text, both inside a circle
      iconY = hasIcon ? 155 : 200;
      textY = hasIcon ? 240 : 210;
      break;

    case 'split':
      // Icon on left/right, text on opposite side
      if (hasIcon && design.iconPosition === 'right') {
        textX = 140;
        textY = 200;
        iconX = 300;
        iconY = 190;
      } else if (hasIcon) {
        // Default: icon left
        iconX = 100;
        iconY = 190;
        textX = 260;
        textY = 200;
      } else {
        textY = 210;
      }
      break;

    case 'overlay':
      // Large icon behind, text on top
      iconY = 190;
      textY = 210;
      break;

    case 'minimal':
      // Just text, maybe small icon underneath
      textY = hasIcon ? 180 : 210;
      iconY = 250;
      break;

    case 'banner':
      // Text at top, icon centered below, underline decoration
      textY = 140;
      iconY = hasIcon ? 250 : 200;
      break;
  }

  // ── Render border / decorations ──────────────────────────────────────────

  switch (design.border) {
    case 'circle':
      parts.push('<circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" stroke-width="4" />');
      break;
    case 'double-circle':
      parts.push('<circle cx="200" cy="200" r="145" fill="none" stroke="currentColor" stroke-width="5" />');
      parts.push('<circle cx="200" cy="200" r="158" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4,4" />');
      break;
    case 'box':
      parts.push('<rect x="40" y="40" width="320" height="320" rx="12" fill="none" stroke="currentColor" stroke-width="3" />');
      break;
    case 'underline':
      parts.push(`<line x1="80" y1="${textY + 12}" x2="320" y2="${textY + 12}" stroke="currentColor" stroke-width="4" />`);
      break;
    case 'dots':
      parts.push('<circle cx="200" cy="200" r="155" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2,8" stroke-linecap="round" />');
      break;
  }

  // ── Render icon ──────────────────────────────────────────────────────────

  if (hasIcon && icon) {
    const s = design.composition === 'overlay' ? Math.max(iconScale, 5) : iconScale;
    const o = iconOffset * s;
    const opacity = design.composition === 'overlay' ? 0.15 : 1;

    if (design.iconFilled) {
      parts.push(`<g transform="translate(${iconX}, ${iconY})"><path d="${icon.path}" fill="currentColor" opacity="${opacity}" transform="translate(${o}, ${o}) scale(${s})" /></g>`);
    } else {
      parts.push(`<g transform="translate(${iconX}, ${iconY})"><path d="${icon.path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" transform="translate(${o}, ${o}) scale(${s})" /></g>`);
    }
  }

  // ── Render text ──────────────────────────────────────────────────────────

  const letterSpacing = design.font === 'display' ? 3 : (design.textStyle === 'light' ? 2 : 0);
  parts.push(`<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" text-anchor="middle" fill="currentColor" letter-spacing="${letterSpacing}">${displayText}</text>`);

  parts.push('</svg>');
  return parts.join('\n');
}

// ── Fallback Designs (no LLM needed) ───────────────────────────────────────────

function fallbackDesigns(hasIcon: boolean): SemanticDesign[] {
  return [
    {
      name: 'Clean Minimal',
      style: 'Understated elegance',
      reasoning: 'Clean composition lets the text speak for itself.',
      composition: 'minimal',
      textSize: 'large',
      textStyle: 'bold',
      font: 'sans',
      uppercase: true,
      iconPosition: hasIcon ? 'below' : 'none',
      iconSize: 'small',
      iconFilled: false,
      border: 'none'
    },
    {
      name: 'Bold Statement',
      style: 'Maximum visual impact',
      reasoning: 'Large icon and heavy text command attention.',
      composition: 'stacked',
      textSize: 'large',
      textStyle: 'heavy',
      font: 'display',
      uppercase: true,
      iconPosition: hasIcon ? 'above' : 'none',
      iconSize: 'large',
      iconFilled: true,
      border: 'underline'
    },
    {
      name: 'Retro Badge',
      style: 'Vintage-inspired circular composition',
      reasoning: 'Classic badge aesthetic with timeless appeal.',
      composition: 'badge',
      textSize: 'medium',
      textStyle: 'bold',
      font: 'serif',
      uppercase: true,
      iconPosition: hasIcon ? 'above' : 'none',
      iconSize: 'medium',
      iconFilled: true,
      border: 'double-circle'
    }
  ];
}

// ── LLM Design Generation ──────────────────────────────────────────────────────

const VALID = {
  composition: ['stacked', 'badge', 'split', 'overlay', 'minimal', 'banner'],
  textSize: ['small', 'medium', 'large'],
  textStyle: ['light', 'regular', 'bold', 'heavy'],
  font: ['sans', 'serif', 'display'],
  iconPosition: ['above', 'below', 'left', 'right', 'behind', 'none'],
  iconSize: ['small', 'medium', 'large'],
  border: ['none', 'underline', 'circle', 'double-circle', 'box', 'dots']
} as const;

function sanitizeDesign(raw: any, hasIcon: boolean, index: number): SemanticDesign {
  return {
    name: String(raw.name || `Design ${index + 1}`),
    style: String(raw.style || ''),
    reasoning: String(raw.reasoning || ''),
    composition: VALID.composition.includes(raw.composition) ? raw.composition : 'stacked',
    textSize: VALID.textSize.includes(raw.textSize) ? raw.textSize : 'medium',
    textStyle: VALID.textStyle.includes(raw.textStyle) ? raw.textStyle : 'bold',
    font: VALID.font.includes(raw.font) ? raw.font : 'sans',
    uppercase: raw.uppercase !== false,
    iconPosition: hasIcon
      ? (VALID.iconPosition.includes(raw.iconPosition) ? raw.iconPosition : 'above')
      : 'none',
    iconSize: VALID.iconSize.includes(raw.iconSize) ? raw.iconSize : 'medium',
    iconFilled: raw.iconFilled !== false,
    border: VALID.border.includes(raw.border) ? raw.border : 'none'
  };
}

export async function generateDesignsFromLLM(
  text: string,
  iconId: string | undefined,
  vibe: string | undefined,
  occasion: string | undefined
): Promise<DesignVariant[]> {
  const hasIcon = !!iconId && iconId !== 'none';
  const icon = hasIcon
    ? ICON_LIBRARY.find(i => i.id === iconId) || ICON_LIBRARY.find(i => i.id === 'star')!
    : null;

  const prompt = [
    'You are a graphic design AI. Return ONLY valid JSON — an array of exactly 3 design objects.',
    '',
    'Each object describes a merch design using these semantic tokens (pick ONE value per field):',
    '',
    '{',
    '  "name": string (creative short name, e.g. "Neon Punch"),',
    '  "style": string (1-line style description),',
    '  "reasoning": string (why this works for the request),',
    '  "composition": "stacked" | "badge" | "split" | "overlay" | "minimal" | "banner",',
    '  "textSize": "small" | "medium" | "large",',
    '  "textStyle": "light" | "regular" | "bold" | "heavy",',
    '  "font": "sans" | "serif" | "display",',
    '  "uppercase": true | false,',
    hasIcon ? '  "iconPosition": "above" | "below" | "left" | "right" | "behind",' : '',
    hasIcon ? '  "iconSize": "small" | "medium" | "large",' : '',
    hasIcon ? '  "iconFilled": true | false,' : '',
    '  "border": "none" | "underline" | "circle" | "double-circle" | "box" | "dots"',
    '}',
    '',
    'Compositions explained:',
    '- stacked: icon above/below text, centered vertically',
    '- badge: circular border with icon and text inside',
    '- split: icon on one side, text on the other',
    '- overlay: large faded icon behind prominent text',
    '- minimal: clean text-focused, small icon if any',
    '- banner: text at top, icon below, like a title card',
    '',
    'RULES:',
    '- Make the 3 designs VERY different (different compositions, fonts, borders).',
    `- The text is: "${text}"`,
    hasIcon ? `- An icon ("${iconId}") is selected. Choose creative positions for it.` : '- No icon selected. Omit iconPosition/iconSize/iconFilled fields.',
    vibe ? `- Vibe: ${vibe}` : '',
    occasion ? `- Occasion: ${occasion}` : '',
    '- Think about what composition and border style best matches the vibe.',
    '- "overlay" works great for bold/dramatic vibes. "badge" for retro/classic. "minimal" for clean/modern.',
    '',
    'Return ONLY the JSON array.'
  ].filter(Boolean).join('\n');

  try {
    const raw = await chatCompletion(
      [{ role: 'system', content: prompt }],
      { responseFormat: 'json' }
    );

    let designs: any[];
    try {
      const parsed = JSON.parse(raw);
      designs = Array.isArray(parsed) ? parsed : parsed.designs || parsed.layouts || [];
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        designs = JSON.parse(match[0]);
      } else {
        throw new Error('Could not parse design response');
      }
    }

    if (!Array.isArray(designs) || designs.length === 0) {
      throw new Error('Empty designs array');
    }

    return designs.slice(0, 3).map((d, i) => {
      const semantic = sanitizeDesign(d, hasIcon, i);
      return {
        id: String.fromCharCode(65 + i),
        name: semantic.name,
        layout: hasIcon ? 'text_icon' as const : 'text_only' as const,
        style: semantic.style,
        svg: renderSemanticToSVG(semantic, text, icon),
        score: 90 - i * 5,
        reasoning: semantic.reasoning
      };
    });
  } catch (err) {
    console.error('LLM design generation failed, using fallback:', err);
    const designs = fallbackDesigns(hasIcon);
    return designs.map((d, i) => ({
      id: String.fromCharCode(65 + i),
      name: d.name,
      layout: hasIcon ? 'text_icon' as const : 'text_only' as const,
      style: d.style,
      svg: renderSemanticToSVG(d, text, icon),
      score: 90 - i * 5,
      reasoning: d.reasoning
    }));
  }
}
