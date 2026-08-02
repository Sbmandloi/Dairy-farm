import { getReportsData } from "@/lib/services/report.service";
import { withAuth } from "@/lib/mobile/guard";
import { ok } from "@/lib/mobile/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/reports
 *
 * The same `getReportsData()` the web Reports page renders from, so the two can
 * never disagree about all-time totals, monthly trends, or who the best
 * customers are.
 */
export const GET = withAuth(async () => ok(await getReportsData()));
