import { chatCompletion } from '@/lib/llm';
import { Icon, ICON_LIBRARY } from '@/lib/icons';
import { DesignVariant } from '@/lib/design';

// ── LLM-Described Design Layout ────────────────────────────────────────────────

export interface DesignLayout {
  name: string;
  style: string;
  reasoning: string;
  text: {
    content: string;
    y: number;          // 0-400 viewBox coordinate
    fontSize: number;   // 24-72
    fontWeight: number; // 400-900
    fontFamily: 'sans-serif' | 'serif' | 'impact';
    letterSpacing: number; // -2 to 6
    textTransform: 'uppercase' | 'none';
  };
  icon?: {
    x: number;          // center X, 0-400
    y: number;          // center Y, 0-400
    scale: number;      // 1-5
    filled: boolean;    // fill vs stroke
    opacity: number;    // 0.1-1
  };
  decorations: Decoration[];
}

type Decoration =
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; strokeWidth: number }
  | { type: 'circle'; cx: number; cy: number; r: number; filled: boolean; strokeWidth: number; strokeDasharray?: string }
  | { type: 'arc-text'; text: string; y: number; fontSize: number };

// ── SVG Renderer ───────────────────────────────────────────────────────────────

function renderLayoutToSVG(layout: DesignLayout, icon: Icon): string {
  const parts: string[] = [];
  parts.push('<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">');

  // Decorations (background elements)
  for (const dec of layout.decorations) {
    if (dec.type === 'circle') {
      if (dec.filled) {
        parts.push(`<circle cx="${dec.cx}" cy="${dec.cy}" r="${dec.r}" fill="currentColor" opacity="0.1" />`);
      } else {
        parts.push(`<circle cx="${dec.cx}" cy="${dec.cy}" r="${dec.r}" fill="none" stroke="currentColor" stroke-width="${dec.strokeWidth}"${dec.strokeDasharray ? ` stroke-dasharray="${dec.strokeDasharray}"` : ''} />`);
      }
    } else if (dec.type === 'line') {
      parts.push(`<line x1="${dec.x1}" y1="${dec.y1}" x2="${dec.x2}" y2="${dec.y2}" stroke="currentColor" stroke-width="${dec.strokeWidth}" />`);
    } else if (dec.type === 'arc-text') {
      parts.push(`<path id="arc-${dec.y}" d="M 60,${dec.y} Q 200,${dec.y + 40} 340,${dec.y}" fill="none" />`);
      parts.push(`<text font-family="'Georgia', serif" font-size="${dec.fontSize}" font-weight="700" fill="currentColor">`);
      parts.push(`<textPath href="#arc-${dec.y}" startOffset="50%" text-anchor="middle">${dec.text}</textPath>`);
      parts.push('</text>');
    }
  }

  // Icon
  if (layout.icon && icon.path) {
    const ix = layout.icon.x;
    const iy = layout.icon.y;
    const s = layout.icon.scale;
    const offset = -12 * s;
    if (layout.icon.filled) {
      parts.push(`<g transform="translate(${ix}, ${iy})"><path d="${icon.path}" fill="currentColor" opacity="${layout.icon.opacity}" transform="translate(${offset}, ${offset}) scale(${s})" /></g>`);
    } else {
      parts.push(`<g transform="translate(${ix}, ${iy})"><path d="${icon.path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${layout.icon.opacity}" transform="translate(${offset}, ${offset}) scale(${s})" /></g>`);
    }
  }

  // Text
  const t = layout.text;
  const fontMap = { 'sans-serif': "'Helvetica Neue', sans-serif", 'serif': "'Georgia', serif", 'impact': "'Impact', sans-serif" };
  const displayText = t.textTransform === 'uppercase' ? t.content.toUpperCase() : t.content;
  parts.push(`<text x="200" y="${t.y}" font-family="${fontMap[t.fontFamily]}" font-size="${t.fontSize}" font-weight="${t.fontWeight}" text-anchor="middle" fill="currentColor" letter-spacing="${t.letterSpacing}">${displayText}</text>`);

  parts.push('</svg>');
  return parts.join('\n');
}

// ── Fallback (original templates) ──────────────────────────────────────────────

function fallbackLayouts(text: string, hasIcon: boolean): DesignLayout[] {
  return [
    {
      name: 'Minimal',
      style: 'Clean text-focused with subtle accent',
      reasoning: 'Clean composition with restrained icon placement.',
      text: { content: text, y: hasIcon ? 180 : 210, fontSize: 48, fontWeight: 700, fontFamily: 'sans-serif', letterSpacing: -1, textTransform: 'uppercase' },
      icon: hasIcon ? { x: 200, y: 240, scale: 1.5, filled: false, opacity: 1 } : undefined,
      decorations: []
    },
    {
      name: 'Bold Statement',
      style: 'Maximum impact with large elements',
      reasoning: 'Commands attention through scale and contrast.',
      text: { content: text, y: 280, fontSize: 56, fontWeight: 900, fontFamily: 'impact', letterSpacing: 2, textTransform: 'uppercase' },
      icon: hasIcon ? { x: 200, y: 140, scale: 4, filled: true, opacity: 0.9 } : undefined,
      decorations: [{ type: 'line', x1: 80, y1: 300, x2: 320, y2: 300, strokeWidth: 4 }]
    },
    {
      name: 'Retro Badge',
      style: 'Vintage-inspired circular composition',
      reasoning: 'Nostalgic aesthetic with circular framing.',
      text: { content: text, y: 260, fontSize: 38, fontWeight: 700, fontFamily: 'serif', letterSpacing: 1, textTransform: 'uppercase' },
      icon: hasIcon ? { x: 200, y: 150, scale: 2.5, filled: true, opacity: 1 } : undefined,
      decorations: [
        { type: 'circle', cx: 200, cy: 200, r: 140, filled: false, strokeWidth: 6 },
        { type: 'circle', cx: 200, cy: 200, r: 150, filled: false, strokeWidth: 2, strokeDasharray: '5,5' }
      ]
    }
  ];
}

// ── LLM Design Generation ──────────────────────────────────────────────────────

export async function generateDesignsFromLLM(
  text: string,
  iconId: string | undefined,
  vibe: string | undefined,
  occasion: string | undefined
): Promise<DesignVariant[]> {
  const hasIcon = !!iconId && iconId !== 'none';
  const icon = hasIcon
    ? ICON_LIBRARY.find(i => i.id === iconId) || ICON_LIBRARY.find(i => i.id === 'star')!
    : ICON_LIBRARY.find(i => i.id === 'star')!;

  const prompt = [
    'You are a graphic design AI. Return ONLY valid JSON — an array of exactly 3 design layout objects.',
    'Each layout describes how to arrange text and an optional icon on a 400x400px merch print area.',
    '',
    'Each layout object MUST have this exact structure:',
    '{',
    '  "name": string (short creative name, e.g. "Neon Minimal"),',
    '  "style": string (1-line style description),',
    '  "reasoning": string (why this design works for the request),',
    '  "text": {',
    '    "content": string (the text to display),',
    '    "y": number (vertical position 100-320),',
    '    "fontSize": number (24-72),',
    '    "fontWeight": number (400 | 700 | 900),',
    '    "fontFamily": "sans-serif" | "serif" | "impact",',
    '    "letterSpacing": number (-2 to 6),',
    '    "textTransform": "uppercase" | "none"',
    '  },',
    hasIcon ? '  "icon": { "x": 200, "y": number (80-300), "scale": number (1-5), "filled": boolean, "opacity": number (0.1-1) },' : '',
    '  "decorations": array of decoration objects (can be empty). Types:',
    '    { "type": "line", "x1": number, "y1": number, "x2": number, "y2": number, "strokeWidth": number }',
    '    { "type": "circle", "cx": number, "cy": number, "r": number, "filled": boolean, "strokeWidth": number, "strokeDasharray"?: string }',
    '}',
    '',
    'RULES:',
    '- Make the 3 designs VERY different from each other (different compositions, font choices, icon placements).',
    '- The text content should always be: "' + text + '"',
    hasIcon ? `- Include an icon in each design. The icon is "${iconId}".` : '- No icon is selected. Do not include icon objects.',
    vibe ? `- Design vibe: ${vibe}` : '',
    occasion ? `- Occasion: ${occasion}` : '',
    '- Think about visual hierarchy, balance, and whitespace.',
    '- Keep decorations minimal (0-3 per design). They enhance, not overwhelm.',
    '- Ensure text and icon don\'t overlap.',
    '',
    'Return ONLY the JSON array. No markdown, no explanation.'
  ].filter(Boolean).join('\n');

  try {
    const raw = await chatCompletion(
      [{ role: 'system', content: prompt }],
      { responseFormat: 'json' }
    );

    let layouts: DesignLayout[];
    try {
      const parsed = JSON.parse(raw);
      layouts = Array.isArray(parsed) ? parsed : parsed.designs || parsed.layouts || [];
    } catch {
      // Try to extract array from response
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        layouts = JSON.parse(match[0]);
      } else {
        throw new Error('Could not parse design layouts');
      }
    }

    if (!Array.isArray(layouts) || layouts.length === 0) {
      throw new Error('Empty layouts array');
    }

    return layouts.slice(0, 3).map((layout, i) => {
      // Sanitize/clamp values
      const safeLayout: DesignLayout = {
        name: String(layout.name || `Design ${i + 1}`),
        style: String(layout.style || ''),
        reasoning: String(layout.reasoning || ''),
        text: {
          content: text, // Always use the original text
          y: clamp(layout.text?.y ?? 200, 80, 350),
          fontSize: clamp(layout.text?.fontSize ?? 48, 24, 72),
          fontWeight: [400, 700, 900].includes(layout.text?.fontWeight) ? layout.text.fontWeight : 700,
          fontFamily: ['sans-serif', 'serif', 'impact'].includes(layout.text?.fontFamily) ? layout.text.fontFamily : 'sans-serif',
          letterSpacing: clamp(layout.text?.letterSpacing ?? 0, -2, 6),
          textTransform: layout.text?.textTransform === 'none' ? 'none' : 'uppercase'
        },
        icon: hasIcon && layout.icon ? {
          x: clamp(layout.icon.x ?? 200, 50, 350),
          y: clamp(layout.icon.y ?? 150, 50, 350),
          scale: clamp(layout.icon.scale ?? 2, 1, 5),
          filled: !!layout.icon.filled,
          opacity: clamp(layout.icon.opacity ?? 1, 0.1, 1)
        } : undefined,
        decorations: sanitizeDecorations(layout.decorations)
      };

      return {
        id: String.fromCharCode(65 + i), // A, B, C
        name: safeLayout.name,
        style: safeLayout.style,
        svg: renderLayoutToSVG(safeLayout, icon),
        score: 90 - i * 5,
        reasoning: safeLayout.reasoning
      };
    });
  } catch (err) {
    console.error('LLM design generation failed, using fallback templates:', err);
    const layouts = fallbackLayouts(text, hasIcon);
    return layouts.map((layout, i) => ({
      id: String.fromCharCode(65 + i),
      name: layout.name,
      style: layout.style,
      svg: renderLayoutToSVG(layout, icon),
      score: 90 - i * 5,
      reasoning: layout.reasoning
    }));
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || isNaN(value)) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function sanitizeDecorations(raw: any[]): Decoration[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).filter((d): d is Decoration => {
    if (!d || typeof d !== 'object') return false;
    if (d.type === 'line') return typeof d.x1 === 'number';
    if (d.type === 'circle') return typeof d.cx === 'number';
    if (d.type === 'arc-text') return typeof d.text === 'string';
    return false;
  }).map(d => {
    if (d.type === 'line') {
      return { type: 'line' as const, x1: clamp(d.x1, 0, 400), y1: clamp(d.y1, 0, 400), x2: clamp(d.x2, 0, 400), y2: clamp(d.y2, 0, 400), strokeWidth: clamp(d.strokeWidth, 1, 8) };
    }
    if (d.type === 'circle') {
      return { type: 'circle' as const, cx: clamp(d.cx, 0, 400), cy: clamp(d.cy, 0, 400), r: clamp(d.r, 10, 200), filled: !!d.filled, strokeWidth: clamp(d.strokeWidth, 1, 8), strokeDasharray: typeof d.strokeDasharray === 'string' ? d.strokeDasharray : undefined };
    }
    return d;
  });
}
