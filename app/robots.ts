import type { MetadataRoute } from "next";

/** docs/10: robots allowed. The sample states pages carry their own noindex. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" } };
}
