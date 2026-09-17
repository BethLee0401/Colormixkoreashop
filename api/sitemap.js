export default async function handler(request, response) {
  const websiteUrl =
    "https://colormixkoreashop.vercel.app";

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return response
      .status(500)
      .send("Supabase environment variables are missing.");
  }

  try {
    const productResponse = await fetch(
      supabaseUrl +
        "/rest/v1/Products?select=id&active=eq.true&order=id.asc",
      {
        headers: {
          apikey: supabaseKey,
          Authorization: "Bearer " + supabaseKey
        }
      }
    );

    if (!productResponse.ok) {
      throw new Error(
        "Unable to load products from Supabase."
      );
    }

    const products = await productResponse.json();

    const staticPages = [
      websiteUrl + "/",
      websiteUrl + "/shopping-guide.html",
      websiteUrl + "/privacy.html"
    ];

    const productPages = products.map(function (product) {
      return (
        websiteUrl +
        "/product.html?id=" +
        encodeURIComponent(product.id)
      );
    });

    const allPages = staticPages.concat(productPages);

    const urls = allPages
      .map(function (url) {
        return [
          "  <url>",
          "    <loc>" + url + "</loc>",
          "  </url>"
        ].join("\n");
      })
      .join("\n");

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      "</urlset>"
    ].join("\n");

    response.setHeader(
      "Content-Type",
      "application/xml; charset=utf-8"
    );

    response.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );

    return response.status(200).send(xml);
  } catch (error) {
    return response
      .status(500)
      .send("Unable to create sitemap.");
  }
}
