import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";

const connectionString = process.env.AzureWebJobsStorage;
const credential = new AzureNamedKeyCredential(
  process.env.STORAGE_ACCOUNT_NAME || "",
  process.env.STORAGE_ACCOUNT_KEY || ""
);

const urlsTable = new TableClient(
  `https://${process.env.STORAGE_ACCOUNT_NAME}.table.core.windows.net`,
  "urls",
  credential
);

const analyticsTable = new TableClient(
  `https://${process.env.STORAGE_ACCOUNT_NAME}.table.core.windows.net`,
  "analytics",
  credential
);

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  const route = context.bindingData.route || "";

  if (req.method === "POST" && route === "api/shorten") {
    await handleShorten(context, req);
  } else if (req.method === "GET" && route === "api/analytics") {
    await handleAnalytics(context);
  } else if (req.method === "GET" && route.length > 0) {
    await handleRedirect(context, route);
  } else {
    context.res = {
      status: 404,
      body: "Not found",
    };
  }
};

async function handleShorten(context: Context, req: HttpRequest) {
  const { url, customSlug } = req.body;
  
  if (!url) {
    context.res = {
      status: 400,
      body: "URL is required",
    };
    return;
  }

  const slug = customSlug || generateSlug();
  
  try {
    await urlsTable.createEntity({
      partitionKey: "urls",
      rowKey: slug,
      url: url,
      createdAt: new Date().toISOString(),
    });

    context.res = {
      body: { slug },
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: "Failed to create shortened URL",
    };
  }
}

async function handleAnalytics(context: Context) {
  try {
    const clicks = [];
    const referrers = new Map<string, number>();
    let totalClicks = 0;

    const analyticsEntities = analyticsTable.listEntities();
    for await (const entity of analyticsEntities) {
      totalClicks++;
      
      const clickDate = entity.timestamp.split("T")[0];
      const referrer = entity.referrer || "Direct";
      
      clicks.push({
        date: clickDate,
        count: 1,
      });
      
      referrers.set(
        referrer,
        (referrers.get(referrer) || 0) + 1
      );
    }

    // Aggregate clicks by date
    const aggregatedClicks = clicks.reduce((acc, curr) => {
      const existing = acc.find(item => item.date === curr.date);
      if (existing) {
        existing.count += curr.count;
      } else {
        acc.push(curr);
      }
      return acc;
    }, [] as { date: string; count: number }[]);

    // Sort clicks by date
    aggregatedClicks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get top referrers
    const topReferrers = Array.from(referrers.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    context.res = {
      body: {
        clicks: aggregatedClicks,
        topReferrers,
        totalClicks,
      },
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: "Failed to fetch analytics",
    };
  }
}

async function handleRedirect(context: Context, slug: string) {
  try {
    const urlEntity = await urlsTable.getEntity("urls", slug);
    
    // Record analytics
    await analyticsTable.createEntity({
      partitionKey: slug,
      rowKey: new Date().toISOString(),
      referrer: context.req?.headers?.referer || "",
      userAgent: context.req?.headers?.["user-agent"] || "",
      timestamp: new Date().toISOString(),
    });

    context.res = {
      status: 302,
      headers: {
        Location: urlEntity.url,
      },
    };
  } catch (error) {
    context.res = {
      status: 404,
      body: "URL not found",
    };
  }
}

function generateSlug(length: number = 6): string {
  const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export default httpTrigger;