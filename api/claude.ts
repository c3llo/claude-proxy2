import type { VercelRequest, VercelResponse } from "vercel";
import crypto from "crypto";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // ✅ CORS 헤더
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ preflight 요청 처리
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const requestId = crypto.randomUUID();

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error("[CLAUDE ERROR]", {
      requestId,
      error: "CLAUDE_API_KEY not set"
    });
    return res.status(500).json({ error: "CLAUDE_API_KEY not set", requestId });
  }

  try {
    /* ==============================
     * ① 원본 요청 로그 (요약)
     * ============================== */
    console.log("[CLAUDE REQUEST]", {
      requestId,
      model: req.body?.model,
      max_tokens: req.body?.max_tokens,
      systemLength: req.body?.system?.length,
      messageCount: req.body?.messages?.length
    });

    /* ==============================
     * ② messages 상세 로그 (핵심)
     * ============================== */
    if (Array.isArray(req.body?.messages)) {
      console.log(
        "[CLAUDE MESSAGES RAW]",
        JSON.stringify(req.body.messages, null, 2)
      );

      console.log("[CLAUDE MESSAGES STATS]", {
        requestId,
        roles: req.body.messages.map((m: any) => m.role),
        totalMessageLength: req.body.messages.reduce(
          (sum: number, m: any) => sum + (m.content?.length || 0),
          0
        )
      });
    } else {
      console.warn("[CLAUDE MESSAGES WARNING]", {
        requestId,
        message: "messages is not an array",
        value: req.body?.messages
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    /* ==============================
     * ③ Claude 응답 로그
     * ============================== */
    console.log("[CLAUDE RESPONSE]", {
      requestId,
      status: response.status,
      usage: data?.usage,
      outputPreview: data?.content?.[0]?.text?.slice(0, 500)
    });

    return res.status(response.status).json({
      ...data,
      requestId
    });

  } catch (e: any) {
    console.error("[CLAUDE ERROR]", {
      requestId,
      message: e.message,
      stack: e.stack
    });

    return res.status(500).json({
      error: e.message,
      requestId
    });
  }
}
