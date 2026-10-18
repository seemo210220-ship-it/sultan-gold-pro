"use strict";

// SULTAN GOLD PRO
// Unified market-data service for Netlify

const DEFAULTS = {
  gold:"XAU/USD",
  silver:"XAG/USD",
  forex:"EUR/USD",
  us:"AAPL",
  saudi:"1120",
  crypto:"BTC/USD",
  nasdaq:"QQQ",
  oil:"WTI/USD"
};

const ALLOWED_FRAMES = new Set([
  "1min",
  "5min",
  "15min",
  "30min",
  "1h",
  "4h",
  "1day",
  "1week",
  "1month"
]);

const VALID_MARKETS = new Set(
  Object.keys(DEFAULTS)
);

function reply(statusCode,data){
  return {
    statusCode,
    headers:{
      "Content-Type":
        "application/json; charset=utf-8",
      "Access-Control-Allow-Origin":"*",
      "Cache-Control":
        "public, max-age=60, s-maxage=90"
    },
    body:JSON.stringify(data)
  };
}

function validSymbol(symbol){
  return (
    symbol.length>=1 &&
    symbol.length<=35 &&
    /^[A-Z0-9._/-]+$/.test(symbol)
  );
}

exports.handler=async function(event){

  if(event.httpMethod && event.httpMethod!=="GET"){
    return reply(405,{
      error:"Method not allowed"
    });
  }

  const apiKey=process.env.TWELVE_DATA_API_KEY;

  if(!apiKey){
    return reply(500,{
      error:"TWELVE_DATA_API_KEY missing"
    });
  }

  const params=event.queryStringParameters||{};

  const market=String(
    params.market||"gold"
  ).toLowerCase();

  const type=String(
    params.type||"candles"
  ).toLowerCase();

  const interval=String(
    params.interval||"15min"
  ).toLowerCase();

  if(!VALID_MARKETS.has(market)){
    return reply(400,{
      error:"Unsupported market"
    });
  }

  if(type!=="candles"&&type!=="price"){
    return reply(400,{
      error:"Unsupported request type"
    });
  }

  if(type==="candles"&&!ALLOWED_FRAMES.has(interval)){
    return reply(400,{
      error:"Unsupported timeframe"
    });
  }

  const symbol=String(
    params.symbol||DEFAULTS[market]
  ).trim().toUpperCase();

  if(!validSymbol(symbol)){
    return reply(400,{
      error:"Invalid symbol",
      message:
        "Use a valid market symbol such as NVDA, BTC/USD or EUR/USD"
    });
  }

  // Saudi stock symbols use the Saudi exchange.
  // Actual availability is determined by Twelve Data.
  const exchange=market==="saudi"
    ?"TADAWUL"
    :null;

  try{

    const endpoint=type==="candles"
      ?"https://api.twelvedata.com/time_series"
      :"https://api.twelvedata.com/price";

    const url=new URL(endpoint);

    url.searchParams.set("symbol",symbol);
    url.searchParams.set("apikey",apiKey);

    if(exchange){
      url.searchParams.set("exchange",exchange);
    }

    if(type==="candles"){
      url.searchParams.set("interval",interval);
      url.searchParams.set("outputsize","500");
      url.searchParams.set("timezone","UTC");
      url.searchParams.set("format","JSON");
    }

    const response=await fetch(url.toString(),{
      signal:AbortSignal.timeout(15000)
    });

    const data=await response.json();

    if(
      !response.ok ||
      data.status==="error" ||
      data.code
    ){
      return reply(502,{
        error:"Market data provider error",
        market,
        symbol,
        interval,
        message:
          data.message||
          "Unable to retrieve market data"
      });
    }

    if(type==="price"){
      const price=Number(data.price);

      if(!Number.isFinite(price)){
        return reply(502,{
          error:"Invalid price response",
          market,
          symbol
        });
      }

      return reply(200,{
        market,
        symbol,
        price
      });
    }

    if(!Array.isArray(data.values)){
      return reply(502,{
        error:"No candle data",
        market,
        symbol,
        interval,
        message:
          "Symbol or interval may not be supported by this data plan"
      });
    }

    return reply(200,{
      market,
      symbol,
      interval,
      timezone:"UTC",
      count:data.values.length,
      values:data.values
    });

  }catch(error){

    return reply(502,{
      error:"Failed to fetch market data",
      message:error.message
    });

  }
};
