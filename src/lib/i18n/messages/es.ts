// Spanish (es) message catalog.
// Keys must stay in sync with en.ts — the test suite enforces this.
export const es = {
  "wallet.connect.cta": "Conectar Freighter",
  "wallet.connect.connecting": "Conectando...",
  "wallet.connect.retry": "Reintentar conexión",
  "wallet.disconnect.cta": "Desconectar",
  "wallet.disconnect.aria": "Desconectar billetera {address}",
  "wallet.error.freighterUnavailable": "La extensión Freighter no está instalada o habilitada.",
  "wallet.error.connectFailed": "No se pudo conectar la billetera.",

  "swap.chainPicker.title": "Seleccionar cadena origen",

  "swap.from.label": "De",
  "swap.from.amountLabel": "Cantidad a intercambiar",
  "swap.from.amountPlaceholder": "0",
  "swap.from.selectChain": "Cadena origen, actualmente {name}",
  "swap.from.selectToken": "Seleccionar token origen, actualmente {symbol}",
  "swap.from.approxValue": "≈ ${value}",

  "swap.to.label": "A",
  "swap.to.tokenGroup": "Token de destino",
  "swap.to.quoteLoading": "Cargando cotización…",

  "swap.slippage.label": "Tolerancia de deslizamiento",
  "swap.slippage.inputLabel": "Porcentaje de tolerancia de deslizamiento",
  "swap.slippage.minOut": "Mínimo recibido: {amount} {token}",

  "swap.quote.solver": "Mejor solver",
  "swap.quote.fillTime": "Tiempo estimado",
  "swap.quote.fillTimeValue": "~{seconds}s",
  "swap.quote.priceImpact": "Impacto de precio",
  "swap.quote.priceImpactValue": "{percent}%",
  "swap.quote.priceImpactBelowMin": "<0.01",
  "swap.quote.protocolFee": "Comisión de protocolo",
  "swap.quote.protocolFeeValue": "{percent}%",
  "swap.quote.rate": "Tasa",
  "swap.quote.unavailable": "Cotización en tiempo real no disponible — mostrando tasa estimada.",
  "swap.quote.noSolver": "Ningún solver está cotizando esta ruta ahora mismo — mostrando tasa estimada.",
  "swap.quote.highPriceImpactWarning": "Impacto de precio alto por encima de {threshold}% — revisa antes de intercambiar.",

  "swap.submit.connecting": "Conectando billetera…",
  "swap.submit.building": "Preparando swap…",
  "swap.submit.awaitingSignature": "Confirmar en Freighter…",
  "swap.submit.submitting": "Enviando…",
  "swap.submit.findingRoute": "Buscando mejor ruta…",
  "swap.submit.success": "Swap enviado ✓ — iniciar un nuevo swap",
  "swap.submit.enterAmount": "Ingresa un monto",
  "swap.submit.cta": "Intercambiar {amount} {srcToken} → {dstToken}",
  "swap.submit.retryCta": "Reintentar: Intercambiar {amount} {srcToken} → {dstToken}",

  "swap.disclaimer": "El swap se liquida directamente en Stellar · Sin tokens envueltos · Protegido por bonos de solver",

  "home.hero.eyebrow": "Stellar Agentic Hackathon 2025",
  "home.hero.titleLine1": "Intercambia desde cualquier cadena",
  "home.hero.titleLine2": "directamente a Stellar.",
  "home.hero.body":
    "Vortex es un protocolo cross-chain basado en intenciones. Expresa lo que quieres y los solvers compiten por cumplirlo — sin puentes, sin tokens envueltos, sin suposiciones de confianza más allá del bono del solver.",
  "home.hero.solverCta": "Conviértete en solver →",

  "home.stats.totalVolume": "Volumen Total",
  "home.stats.intentsFilled": "Intenciones Completadas",
  "home.stats.activeSolvers": "Solvers Activos",
  "home.stats.avgFillTime": "Tiempo Medio de Llenado",

  "home.pipeline.title": "Cómo funciona",
  "home.pipeline.intent.label": "Intención",
  "home.pipeline.intent.sub": "Tú envías",
  "home.pipeline.auction.label": "Subasta",
  "home.pipeline.auction.sub": "Solvers pujan",
  "home.pipeline.relay.label": "Relay",
  "home.pipeline.relay.sub": "El mejor llena",
  "home.pipeline.settle.label": "Liquidar",
  "home.pipeline.settle.sub": "En Stellar",

  "home.feed.title": "Llenados en Vivo",
  "home.feed.viewAll": "Ver todos →",

  "home.chains.title": "Cadenas soportadas",
  "home.chains.stellarDestination": "Stellar (dest.)",

  "notFound.breadcrumb": "No Encontrado",
  "notFound.eyebrow": "404",
  "notFound.title": "Página no encontrada",
  "notFound.body": "La página que buscas no existe o puede haber sido movida.",
  "notFound.backHome": "← Volver a Vortex",
} as const;
