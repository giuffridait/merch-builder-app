# MerchForge - AI-Guided Merch Builder

MerchForge is a Next.js app that pairs a conversational assistant with a product catalog to guide users through discovery and customization flows for custom merch.

## Key Features

### Inventory Discovery (Agentic)
- Natural language constraints (budget, color, material, quantity, timing)
- Ranked recommendations with clear rationale
- Strict constraint handling (no hallucinated colors/materials/sizes)
- Cart-ready selection

### Customization Flow
- Guided design conversation powered by LLM JSON outputs (non-streaming)
- Self-correcting JSON parsing for robust state updates
- Fully agentic updates (product, text, colors, size, quantity, icon)
- Text-only or icon-based designs (icon optional)
- 3 SVG design variants with a recommended pick
- Live preview with color-specific product images
- Text color selection + basic layering controls (scale/position)
- Cart-ready configuration

### Commerce Preparedness
- ACP/UCP readiness documentation
- Inventory schema + capability flags
- **Agentic Workflow Documentation**: Detailed explanation of flows, guardrails, and limitations (`/preparedness`)

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
│   │   ├── page.tsx          # Server wrapper
│   │   └── CreatePageClient.tsx
│   ├── discover/
│   │   └── page.tsx          # Inventory discovery
│   ├── cart/
│   │   └── page.tsx          # Shopping cart
│   ├── preparedness/
│   │   └── page.jsx          # ACP/UCP readiness
│   ├── api/
│   │   ├── chat/route.ts     # Legacy customization assistant (API)
│   │   ├── create/route.ts   # New streaming customization assistant (API)
│   │   └── discover/route.ts # Inventory assistant
│   ├── actions.ts            # Legacy Server Actions (Agentic Chat)
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home
│   └── globals.css           # Global styles
├── lib/
│   ├── catalog.ts            # Product catalog
│   ├── icons.ts              # Icon library + keyword matching
│   ├── design.ts             # SVG variant generation
│   ├── cart.ts               # LocalStorage cart management
│   ├── agent.ts              # Conversational AI logic
│   └── customization-constraints.ts # Customization limits + validation
├── data/
│   ├── inventory.acp.json    # Inventory schema
│   └── ucp-capabilities.json # Capability flags
├── scripts/
│   ├── validate-inventory.js # Inventory validation
│   └── smoke-discover.js     # API smoke tests
├── public/
├── middleware.ts             # Basic auth (optional)
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

1. **Intent capture** → extract product, budget, color, material, quantity, timing  
2. **Constraint resolution** → validate against inventory and availability  
3. **Inventory reasoning** → rank candidates, keep fallbacks  
4. **Product selection** → present top pick + rationale  
5. **Cart-ready output** → price + delivery estimate  

### Example: Customization

```
User: "I want a tote for my running team"
AI: "What message should it say?"
```

### Agentic Flow With Guardrails (Customization)
- Flexible stage progression (welcome → product → intent → text → icon → preview), but can skip or rewind.
- Multi-field updates in a single turn (e.g., product + color + text).
- Self-correction retry when JSON parsing fails.
- Two distinct flows exist: discovery (`/discover`) for constraint-based inventory ranking, and customization (`/create`) for guided configuration.
 - Customization responses are currently non-streaming (single response per turn).
 - Discovery can run deterministic constraint parsing before the LLM reply (optimistic preview), then reconciles with the LLM.

Limitations:
- No external tool use (no real-time inventory APIs).
- Single-turn reasoning per LLM call (self-correction is a minimal recovery step).
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
- Discovery: `app/api/discover/route.ts`
- Customization: `app/api/chat/route.ts` (non-streaming) + `lib/agent-llm.ts`
- Legacy/experimental: `app/api/create/route.ts`, `app/actions.ts`

### Add New Design Variants
Edit `lib/design.ts` to add a new SVG generator.

### Product Preview Images
Color-specific preview images are mapped in `lib/catalog.ts` under `imageUrlByColor`.

### Customization Constraints
Defined in `lib/customization-constraints.ts` (text length, quantities, allowed colors/vibes/occasions).

## License

MIT

Built for demonstrating agentic commerce UX patterns.
