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

- **UCP Readiness**
- **Capability expectations** captured in `data/ucp-capabilities.json`
- **Flow separation** between discovery (`/discover`) and configuration (`/create`)
- **Streaming interaction** implemented for configuration flow via Server-Sent Events (SSE)
- **Robust config parsing** with fuzzy keyword matching for product, color, and size
- **Cart-ready configuration** output via `CartItem` schema (price, currency, delivery estimate)

Potential future work:
- Add a UCP capability file (supported checkout methods, shipping estimation)
- Implement a negotiation/checkout adapter layer
