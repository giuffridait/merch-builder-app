# Commerce Preparedness (ACP + UCP)

This project is not integrated with ACP or UCP, but it is structured to be ready.

## ACP Readiness
- **ACP-shaped inventory** stored in `data/inventory.acp.json`
- Core fields included: `item_id`, `price`, `availability`, `is_eligible_search`, `is_eligible_checkout`
- Inventory reasoning uses ACP data for filtering and ranking

Gaps for official ACP integration:
- Export feed in ACP-required formats (JSONL/CSV)
- Public `url` and `image_url` with stable hosting
- Automated syncs for price/availability

## UCP Readiness
- **Capability expectations** captured in `data/ucp-capabilities.json`
- **Flow separation** between discovery (`/discover`) and configuration (`/create`)
- **Cart-ready configuration** output via `CartItem` schema (price, currency, delivery estimate)

## Agentic Flow With Guardrails
- Flexible stage progression (welcome → product → intent → text → icon → preview), but can skip or rewind.
- Multi-field updates in a single turn (e.g., product + color + text).
- Self-correction retry when JSON parsing fails.
- Two distinct flows exist: discovery (`/discover`) for constraint-based inventory ranking, and customization (`/create`) for guided configuration.

Limitations:
- No external tool use (no real-time inventory APIs).
- Single-turn reasoning per LLM call (self-correction is a minimal recovery step).
- Bounded decision space (products, colors, icons, sizes defined in catalog).
- Scripted goal (cart-ready merch is the defined outcome).

Potential future work:
- Add a UCP capability file (supported checkout methods, shipping estimation)
- Implement a negotiation/checkout adapter layer
