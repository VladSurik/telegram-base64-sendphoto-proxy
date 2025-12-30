const express = require("express");
const https = require("https");

const app = express();
app.use(express.json({ limit: "25mb" })); // під base64

function base64ToBuffer(b64) {
  // підтримка data:image/png;base64,....
  const comma = b64.indexOf(",");
  if (comma !== -1) b64 = b64.slice(comma + 1);
  b64 = b64.replace(/\s+/g, "");
  return Buffer.from(b64, "base64");
}

function buildMultipartSendPhoto({ chat_id, photoBuffer, filename, mime, caption }) {
  const boundary = "----NodeBoundary" + Date.now();
  const CRLF = "\r\n";

  const parts = [];

  // chat_id
  parts.push(Buffer.from(`--${boundary}${CRLF}`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="chat_id"${CRLF}${CRLF}`));
  parts.push(Buffer.from(String(chat_id)));
  parts.push(Buffer.from(CRLF));

  // caption (optional)
  if (caption) {
    parts.push(Buffer.from(`--${boundary}${CRLF}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="caption"${CRLF}${CRLF}`));
    parts.push(Buffer.from(String(caption)));
    parts.push(Buffer.from(CRLF));
  }

  // photo file
  parts.push(Buffer.from(`--${boundary}${CRLF}`));
  parts.push(
    Buffer.from(
      `Content-Disposition: form-data; name="photo"; filename="${filename || "qr.png"}"${CRLF}`
    )
  );
  parts.push(Buffer.from(`Content-Type: ${mime || "image/png"}${CRLF}${CRLF}`));
  parts.push(photoBuffer);
  parts.push(Buffer.from(CRLF));

  // end
  parts.push(Buffer.from(`--${boundary}--${CRLF}`));

  const body = Buffer.concat(parts);

  return {
    body,
    boundary,
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length)
    }
  };
}

function telegramSendPhoto({ token, multipart }) {
  return new Promise((resolve, reject) => {
    const options = {
      method: "POST",
      hostname: "api.telegram.org",
      path: `/bot${token}/sendPhoto`,
      headers: multipart.headers
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", reject);
    req.write(multipart.body);
    req.end();
  });
}

// Healthcheck
app.get("/", (req, res) => res.json({ ok: true }));

// Main endpoint
app.post("/send-qr", async (req, res) => {
  try {
    const { token, chat_id, base64, filename, mime, caption } = req.body || {};

    if (!token || !chat_id || !base64) {
      return res.status(400).json({
        ok: false,
        error: "Required fields: token, chat_id, base64"
      });
    }

    const photoBuffer = base64ToBuffer(base64);

    // не логуй сам base64
    console.log("send-qr:", { chat_id, bytes: photoBuffer.length, mime: mime || "image/png" });

    const multipart = buildMultipartSendPhoto({
      chat_id,
      photoBuffer,
      filename,
      mime,
      caption
    });

    const tg = await telegramSendPhoto({ token, multipart });

    return res.status(200).json({
      ok: true,
      telegram_status: tg.status,
      telegram: tg.json || tg.raw
    });
  } catch (err) {
    console.error("send-qr error:", err);
    return res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy listening on port", PORT));
