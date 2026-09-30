# Swap links and drafts

Swap deep links use only `srcChain`, `srcToken`, `amount`, and `dstToken`; destination addresses are intentionally never accepted from URLs. `parseSwapLink` validates against the current market registry before the form is prefilled. Draft persistence is versioned, wallet-bound, expires after 24 hours by default, and must never contain signed payloads.

Federation aliases are resolved through the server route, which accepts only a validated `name*domain` shape, HTTPS requests, bounded time, blocked private addresses, and no redirects.
