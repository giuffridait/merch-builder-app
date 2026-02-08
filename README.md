# MerchForge - AI-Guided Merch Builder

MerchForge is a Next.js app that pairs a conversational assistant with a product catalog to guide users through discovery and customization flows for custom merch.

## Key Features

### Inventory Discovery (Agentic)
- Natural language constraints (budget, color, material, quantity, timing)
- Ranked recommendations with clear rationale
- Strict constraint handling (no hallucinated colors/materials/sizes)
- Cart-ready selection

### Customization Flow (Agentic)
- Constraint-based readiness — no rigid stage machine; users can specify everything in any order or all at once (e.g., "navy tee with 'Dream Big' and a star")
- Real SSE streaming from LLM providers (Ollama, Groq, OpenAI-compatible)
- LLM-powered design generation — the AI describes design layouts (text positioning, icon placement, decorations) as structured JSON, which is rendered into SVG
- Deterministic keyword fallback ensures the app works even when the LLM is unavailable
- Live preview with color-specific product images
- Text color selection + layering controls (scale/position)
- Cart-ready configuration

### Commerce Preparedness
- ACP/UCP readiness documentation
- Inventory schema + capability flags
- **Agentic Workflow Documentation**: Detailed explanation of flows, guardrails, and limitations (`/preparedness`)

## What's Agentic

### Conversation Engine (`lib/conversation-engine.ts`)
- **LLM-driven state extraction** — Both the `/create` and `/discover` flows use an LLM that returns structured JSON with an `assistant` message plus `updates` that mutate the conversation state (product selection, constraints, etc.). The model autonomously decides which fields to populate (product, color, text, icon, size, quantity) and can trigger actions like `add_to_cart` or `remove_icon`.
- **Constraint-based readiness** — Instead of a rigid stage machine, the engine uses readiness predicates (`canPreview`, `canAddToCart`, `getMissingFields`) and tells the LLM what's still needed. Users can fill everything in one message or across many turns.
- **Structured outputs** — Uses native JSON mode (Ollama `format: "json"`, OpenAI/Groq `response_format`) for reliable structured extraction.

### Design Generation (`lib/design-engine.ts`)
- **LLM as design collaborator** — When the user provides enough context (product + text/icon), the LLM is asked to describe 3 distinct design layouts as structured JSON: text position, font choice, icon placement/scale, decorative elements (circles, lines, arcs). A renderer turns these descriptions into SVG.
- **Creative variation** — The LLM is prompted to make designs "very different from each other" and considers the user's vibe and occasion.
- **Graceful fallback** — If the LLM fails, hardcoded template layouts (Minimal, Bold, Retro Badge) are used instead.

### Discovery Flow (`app/api/discover/route.ts`)
- **LLM-guided ranking** — The LLM can return a `selection` object with `primaryIds` and `fallbackIds` to reorder results, plus a `rationale` explaining its choices.

### What's NOT Fully Agentic
- **No multi-step tool chains** — The LLM doesn't call external APIs or chain multiple tool calls in a single turn. Design generation is a separate API call triggered by the client when readiness conditions are met, not an autonomous LLM decision.
- **No persistent memory** — No RAG, no cross-session learning. Context is limited to the current conversation window (last 8 messages).
- **Deterministic guardrails** — Keyword-based `parseKeywordUpdates()` always runs alongside the LLM and takes precedence. If the LLM hallucinates a product or color not in the catalog, `validateCustomizationUpdates()` rejects it.

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
cd merch-builder-app
npm install
npm run dev
```

Open `http://localhost:3000`.

### Build for Production

```bash
npm run build
npm start
```

## Environment Variables

Create a `.env.local` for development or set these in Vercel:

```
LLM_PROVIDER=ollama | groq | openai

# Groq (recommended hosted provider)
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile

# Optional basic auth
BASIC_AUTH_USER=...
BASIC_AUTH_PASS=...
```

Notes:
- Vercel cannot run Ollama, so use Groq (or another hosted provider) in production.
- If basic auth variables are not set, the site is public.

## Tests

```bash
npm run test:inventory
npm run test:smoke
```

## Deploy to Vercel

### Option 1: Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option 2: Vercel Dashboard
1. Push code to GitHub
2. Go to vercel.com
3. Click "New Project"
4. Import the repository
5. Set environment variables

## Project Structure

```
merch-builder-app/
├── app/
│   ├── create/
│   │   ├── page.tsx                    # Server wrapper
│   │   ├── CreatePageClient.tsx        # Slim orchestrator
│   │   ├── hooks/
│   │   │   └── useCreateFlow.ts        # All client state + LLM interaction
│   │   └── components/
│   │       ├── ChatPanel.tsx           # Messages, input, suggestions
│   │       ├── PreviewPanel.tsx        # Product image + design overlay
│   │       ├── DesignPicker.tsx        # Design variant selection
│   │       └── OptionsPanel.tsx        # Color, size, quantity, add-to-cart
│   ├── discover/
│   │   └── page.tsx                    # Inventory discovery
│   ├── cart/
│   │   └── page.tsx                    # Shopping cart
│   ├── preparedness/
│   │   └── page.jsx                    # ACP/UCP readiness
│   ├── api/
│   │   ├── chat/route.ts              # Customization assistant (thin wrapper)
│   │   ├── create/route.ts            # Streaming customization (thin wrapper)
│   │   ├── designs/route.ts           # LLM-powered design generation
│   │   └── discover/route.ts          # Inventory assistant
│   ├── actions.ts                      # Server Actions
│   ├── layout.tsx                      # Root layout
│   ├── page.tsx                        # Home
│   └── globals.css                     # Global styles
├── lib/
│   ├── conversation-engine.ts          # Consolidated LLM logic (prompt, fallback, streaming)
│   ├── design-engine.ts               # LLM-powered design generation + SVG renderer
│   ├── llm.ts                         # Multi-provider LLM abstraction (chat + streaming)
│   ├── agent.ts                       # ConversationState + readiness predicates
│   ├── catalog.ts                     # Product catalog
│   ├── icons.ts                       # Icon library + keyword matching
│   ├── design.ts                      # SVG variant templates (fallback)
│   ├── cart.ts                        # LocalStorage cart management
│   ├── discover.ts                    # Discovery constraint parsing + ranking
│   └── customization-constraints.ts   # Validation + allowed values
├── data/
│   ├── inventory.acp.json             # Inventory schema
│   └── ucp-capabilities.json          # Capability flags
├── scripts/
│   ├── validate-inventory.js          # Inventory validation
│   └── smoke-discover.js             # API smoke tests
├── public/
├── middleware.ts                      # Basic auth (optional)
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

## Conversation Flow

### Example: Discovery

```
User: "I need black hoodies under €100 for a team"
AI: "Here are 2 options for black hoodies under €100. Top pick: Premium Hoodie."
```

### Agentic Flow (Discovery)

1. **Intent capture** — extract product, budget, color, material, quantity, timing
2. **Constraint resolution** — validate against inventory and availability
3. **Inventory reasoning** — rank candidates, keep fallbacks
4. **Product selection** — present top pick + rationale
5. **Cart-ready output** — price + delivery estimate

### Example: Customization

```
User: "Navy tee with 'Dream Big' and a star icon"
AI: "I've set up a navy Classic Tee with 'Dream Big' and a star. Here are 3 design layouts — pick your favorite or customize further."
```

### Agentic Flow (Customization)
- **Constraint-based progression** — readiness predicates (`canPreview`, `canAddToCart`) replace the old rigid stage machine. The UI reactively shows design variants when enough fields are filled.
- **Multi-field updates in a single turn** (e.g., product + color + text + icon all at once).
- **LLM-generated designs** — when preview-ready, the AI proposes 3 distinct SVG layouts with different compositions, fonts, and decorative elements.
- **Deterministic keyword fallback** — regex-based parsing always runs alongside the LLM for robustness.

Limitations:
- No external tool use (no real-time inventory APIs).
- Single-turn reasoning per LLM call (no multi-step planning).
- Bounded decision space (products, colors, icons, sizes defined in catalog).
- Scripted goal (cart-ready merch is the defined outcome).

## Customization

### Add or Update Inventory
Edit `data/inventory.acp.json` and run:
```
npm run test:inventory
```

### Add More Icons
Edit `lib/icons.ts` and add keyword mappings.

### Adjust AI Responses
- Conversation engine: `lib/conversation-engine.ts` (system prompt, keyword fallback, streaming)
- Design generation: `lib/design-engine.ts` (layout prompt, SVG renderer)
- Discovery: `app/api/discover/route.ts`

### Add New Design Variants
Edit `lib/design-engine.ts` to modify the LLM prompt or add fallback templates. The SVG renderer (`renderLayoutToSVG`) supports text, icons, lines, circles, and arc-text decorations.

### Product Preview Images
Color-specific preview images are mapped in `lib/catalog.ts` under `imageUrlByColor`.

### Customization Constraints
Defined in `lib/customization-constraints.ts` (text length, quantities, allowed colors/vibes/occasions).

## License

MIT

Built for demonstrating agentic commerce UX patterns.
