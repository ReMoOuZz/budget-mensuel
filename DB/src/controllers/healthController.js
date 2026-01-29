export function health(req, res) {
  return res.json({ status: "ok", uptime: process.uptime() });
}
