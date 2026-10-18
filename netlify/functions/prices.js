exports.handler = async function (event) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  const reply = (statusCode, data) => ({
    statusCode,
    headers,
    body: JSON.stringify(data)
  });

  if (!apiKey) {
    return reply(500, {
      error: "TWELVE_DATA_API_KEY missing"
    });
  }

  const params = event.queryStringParameters || {};
  const type = params.type || "price";
  const market = (params.market || "gold").toLowerCase();

  const symbols = {
    gold: "XAU/USD",
    silver: "XAG/USD"
  };

  const symbol = symbols[market];

  if (!symbol) {
    return reply(400, { error: "Unsupported market" });
  }

  if (!["price", "candles"].includes(type)) {
    return reply(400, { error: "Unsupported request type" });
  }

  try {
    const endpoint = type === "candles"
      ? "https://api.twelvedata.com/time_series"
      : "https://api.twelvedata.com/price";

    const url = new URL(endpoint);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("apikey", apiKey);

    if (type === "candles") {
      url.searchParams.set("interval", "15min");
      url.searchParams.set("outputsize", "300");
      url.searchParams.set("timezone", "UTC");
    }

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12000)
    });

    const data = await response.json();

    if (!response.ok || data.status === "error" || data.code) {
      return reply(502, {
        error: "Market data provider error",
        message: data.message || "Unable to fetch data"
      });
    }

    if (type === "candles") {
      if (!Array.isArray(data.values)) {
        return reply(502, {
          error: "No candle data returned"
        });
      }

      return reply(200, {
        symbol,
        interval: "15min",
        timezone: "UTC",
        values: data.values
      });
    }

    return reply(200, {
      symbol,
      price: data.price
    });

  } catch (error) {
    return reply(500, {
      error: "Failed to fetch market data",
      message: error.message
    });
  }
};
