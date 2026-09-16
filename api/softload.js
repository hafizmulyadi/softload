import { createHash } from "node:crypto";

const routes = {
  health: ["GET", "/healthz"],
  info: ["POST", "/info"],
  create: ["POST", "/jobs"],
  status: ["GET", "/jobs/"],
  cancel: ["DELETE", "/jobs/"],
  file: ["GET", "/jobs/"],
};
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const json = (status, body) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };
  const op = req.query?.op;
  const route = routes[op];
  if (!route) return json(404, { error: "Endpoint tidak ditemukan." });
  if (req.method !== route[0])
    return json(405, { error: "Metode tidak diizinkan." });
  if (
    ["POST", "DELETE"].includes(req.method) &&
    req.headers["x-softload"] !== "1"
  )
    return json(403, { error: "Permintaan tidak valid." });
  const base = process.env.BACKEND_URL,
    secret = process.env.BACKEND_SECRET;
  if (!base || !secret || secret.length < 32)
    return json(503, {
      error: "Backend belum dikonfigurasi oleh pemilik web.",
    });
  let target;
  try {
    target = new URL(base);
    const local =
      process.env.SOFTLOAD_LOCAL === "1" &&
      target.protocol === "http:" &&
      target.hostname === "127.0.0.1";
    if (
      (!local && target.protocol !== "https:") ||
      target.username ||
      target.password ||
      target.search ||
      target.hash
    )
      throw new Error();
  } catch {
    return json(503, {
      error: "Alamat backend harus berupa HTTPS yang valid.",
    });
  }
  const id = req.query?.id;
  if (
    ["status", "cancel", "file"].includes(op) &&
    (typeof id !== "string" || !/^[a-f0-9]{32}$/.test(id))
  )
    return json(400, { error: "ID proses tidak valid." });
  let body;
  if (req.method === "POST") {
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || typeof body.url !== "string" || body.url.length > 2048)
        throw new Error();
      body = {
        url: body.url,
        ...(op === "create"
          ? { format: body.format, quality: body.quality }
          : {}),
      };
    } catch {
      return json(400, { error: "Data permintaan tidak valid." });
    }
  }
  const client = createHash("sha256")
    .update(
      String(
        req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "unknown",
      ).slice(0, 200),
    )
    .digest("hex");
  target.pathname =
    route[1] +
    (["status", "cancel", "file"].includes(op) ? id : "") +
    (op === "file" ? "/link" : "");
  try {
    const response = await fetch(target, {
      method: req.method,
      redirect: "error",
      headers: {
        Authorization: "Bearer " + secret,
        "Content-Type": "application/json",
        "X-Softload-Client": client,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(52000),
    });
    const result = await response.json();
    if (op === "file" && response.ok) {
      const url = new URL(result.url);
      if (url.origin !== target.origin || !url.pathname.startsWith("/files/"))
        throw new Error("Invalid file location");
      res.statusCode = 302;
      res.setHeader("Location", url.href);
      return res.end();
    }
    return json(response.status, result);
  } catch (error) {
    console.error("SOFTLOAD FETCH ERROR:", error);

    return json(502, {
      error: "Backend tidak dapat dihubungi.",
      debug: error?.message || String(error),
      cause: error?.cause?.message || null,
      code: error?.cause?.code || null,
    });
  }
}
