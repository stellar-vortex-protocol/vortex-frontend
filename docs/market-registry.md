# Market registry contract

The relay may expose `GET /config/assets` with:

```json
{
  "chains": [{"id":"ethereum","name":"Ethereum","shortName":"ETH","color":"#627EEA"}],
  "srcTokens": {"ethereum": [{"symbol":"USDC","name":"USD Coin","decimals":6,"priceUsd":1,"issuer":"…"}]},
  "dstTokens": [{"symbol":"XLM","decimals":7,"priceUsd":0.1,"contract":"native"}],
  "pricesAsOf": "2026-09-27T00:00:00Z",
  "priceSource": "relay"
}
```

Invalid entries are discarded and a bundled immutable snapshot is used when
the endpoint is unavailable. Consumers should display prices as unavailable
when `isStale` is true rather than silently presenting old values.
