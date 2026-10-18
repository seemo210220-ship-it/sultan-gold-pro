"use strict";

// SULTAN GOLD PRO
// Netlify Market Data Function

const MARKETS = {
  gold: {
    symbol: "XAU/USD"
  },
  silver: {
    symbol: "XAG/USD"
  },
  forex: {
    symbol: "EUR/USD"
  },
  us: {
    symbol: "AAPL"
  },
  saudi: {
    symbol: "1120",
    exchange: "TADAWUL"
  },
  crypto: {
    symbol: "BTC/USD"
  },
  nasdaq: {
    symbol: "QQQ"
  },
  oil: {
    symbol: "WTI/USD"
  }
};

function reply(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=90",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(data)
  };
}

exports.handler = async function(event) {
  if (event.httpMethod && event.httpMethod !== "GET") {
    return reply(405, {
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return reply(500, {
      error: "TWELVE_DATA_API_KEY missing"
    });
  }

  const params = event.queryStringParameters || {};
  const market = String(params.market || "gold").toLowerCase();
  const type = String(params.type || "candles").toLowerCase();
  const config = MARKETS[market];

  if (!config) {
    return reply(400, {
      error: "Unsupported market"
    });
  }

  if (type !== "candles" && type !== "price") {
    return reply(400, {
      error: "Unsupported request type"
    });
  }

  try {
    const endpoint = type === "candles"
      ? "https://api.twelvedata.com/time_series"
      : "https://api.twelvedata.com/price";

    const url = new URL(endpoint);

    url.searchParams.set("symbol", config.symbol);
    url.searchParams.set("apikey", apiKey);

    if (config.exchange) {
      url.searchParams.set("exchange", config.exchange);
    }

    if (type === "candles") {
      url.searchParams.set("interval", "15min");
      url.searchParams.set("outputsize", "500");
      url.searchParams.set("timezone", "UTC");
      url.searchParams.set("format", "JSON");
    }

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000)
    });

    const data = await response.json();

    if (
      !response.ok ||
      data.status === "error" ||
      data.code
    ) {
      return reply(502, {
        error: "Market data provider error",
        market,
        message: data.message || "Unable to retrieve market data"
      });
    }

    if (type === "price") {
      const price = Number(data.price);

      if (!Number.isFinite(price)) {
        return reply(502, {
          error: "Invalid price data"
        });
      }

      return reply(200, {
        market,
        symbol: config.symbol,
        price
      });
    }

    if (!Array.isArray(data.values)) {
      return reply(502, {
        error: "No candle data returned",
        market,
        message: "This symbol or interval may not be available on your Twelve Data plan"
      });
    }

    return reply(200, {
      market,
      symbol: config.symbol,
      interval: "15min",
      timezone: "UTC",
      count: data.values.length,
      values: data.values
    });

  } catch (error) {
    return reply(502, {
      error: "Failed to fetch market data",
      message: error.message
    });
  }
};
