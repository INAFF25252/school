import { UAParser } from "ua-parser-js";

export type ClientContext = {
  device: string;
  location: string;
  ip: string;
};

/**
 * Best-effort location/device from request headers (Vercel / common proxies).
 * Outside Vercel, geo headers are often absent — we still show IP + User-Agent summary.
 */
export function getClientContextFromRequest(request: Request): ClientContext {
  const uaRaw = request.headers.get("user-agent") ?? "";
  const parser = new UAParser(uaRaw);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = [browser.name, os.name].filter(Boolean).join(" on ") || uaRaw.slice(0, 160) || "Unknown";

  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "Unknown";

  const city = request.headers.get("x-vercel-ip-city");
  const region = request.headers.get("x-vercel-ip-country-region");
  const country =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-country") ||
    "";

  const locationParts = [city, region, country].filter(Boolean);
  const location = locationParts.length
    ? locationParts.join(", ")
    : "Approximate location unavailable (run on Vercel or behind a CDN with geo headers)";

  return { device, location, ip };
}
