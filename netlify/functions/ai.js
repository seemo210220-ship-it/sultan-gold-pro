"use strict";

// SULTAN GOLD AI
// Netlify server function

const ALLOWED_ORIGIN = "https://imaginative-scone-899048.netlify.app";

function reply(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
}

exports.handler = async function(event) {

  if (event.httpMethod !== "POST") {
    return reply(405, {
      error: "POST requests only"
    });
  }

  // Stay disabled until API key, access controls,
  // and usage limits are configured.
  if (process.env.SULTAN_AI_ENABLED !== "true") {
    return reply(503, {
      error: "SULTAN GOLD AI is not activated yet"
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return reply(503, {
      error: "AI API key is not configured"
    });
  }

  try {
    if ((event.body || "").length > 12000) {
      return reply(413, {
        error: "Request is too large"
      });
    }

    const input = JSON.parse(event.body || "{}");

    const symbol = String(input.symbol || "")
      .trim()
      .toUpperCase();

    const timeframe = String(input.timeframe || "")
      .trim();

    const candles = input.candles;

    if (
      !/^[A-Z0-9._/-]{1,35}$/.test(symbol) ||
      !/^(1min|5min|15min|30min|1h|4h|1day|1week)$/.test(timeframe) ||
      !Array.isArray(candles) ||
      candles.length < 30 ||
      candles.length > 120
    ) {
      return reply(400, {
        error: "Valid symbol, timeframe and 30-120 candles required"
      });
    }

    const cleanCandles = candles.map(c => ({
      time: String(c.time ?? "").slice(0, 35),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close)
    }));

    if (cleanCandles.some(c =>
      !Number.isFinite(c.open) ||
      !Number.isFinite(c.high) ||
      !Number.isFinite(c.low) ||
      !Number.isFinite(c.close) ||
      c.high < Math.max(c.open, c.close) ||
      c.low > Math.min(c.open, c.close)
    )) {
      return reply(400, {
        error: "Invalid candle data"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 650,
          messages: [
            {
              role: "system",
              content: [
                "أنت SULTAN GOLD AI، مساعد تعليمي للتحليل الفني.",
                "أجب بالعربية بأسلوب واضح ومختصر.",
                "حلل بيانات الشموع المقدمة فقط.",
                "لا تدّع امتلاك أسعار أو أخبار مباشرة.",
                "اشرح الاتجاه والزخم والدعم والمقاومة.",
                "إذا لم تتضح فرصة فاذكر الانتظار.",
                "لا تخترع إشارات أو أهدافًا مضمونة.",
                "اذكر المخاطر وعدم اليقين.",
                "المحتوى تعليمي وليس توصية مالية.",
                "لا تنفذ صفقات ولا تطلب بيانات الحساب."
              ].join(" ")
            },
            {
              role: "user",
              content: JSON.stringify({
                task: "حلل حركة السعر فنيًا",
                symbol,
                timeframe,
                candles: cleanCandles
              })
            }
          ]
        }),
        signal: AbortSignal.timeout(20000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return reply(502, {
        error: "AI provider request failed"
      });
    }

    const analysis =
      data.choices?.[0]?.message?.content;

    if (!analysis) {
      return reply(502, {
        error: "No AI analysis returned"
      });
    }

    return reply(200, {
      platform: "SULTAN GOLD AI",
      symbol,
      timeframe,
      analysis,
      disclaimer: "تحليل تعليمي وليس توصية مالية"
    });

  } catch (error) {
    return reply(500, {
      error: "AI analysis temporarily unavailable"
    });
  }
};
