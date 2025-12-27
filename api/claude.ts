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

  // POST만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  /* ==============================
   * ① requestId 생성 (최상단)
   * ============================== */
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
     * ② Claude 호출 직전 로그
     * ============================== */
    console.log("[CLAUDE REQUEST]", {
      requestId,
      body: req.body
      // 필요하면 여기서
      // model: req.body?.model
      // system: req.body?.system
    });

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
      outputPreview: data?.content?.[0]?.text?.slice(0, 500) // 로그 폭주 방지
    });

    return res.status(response.status).json({
      ...data,
      requestId
    });

  } catch (e: any) {

    /* ==============================
     * ④ 에러 로그 (매우 중요)
     * ============================== */
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
