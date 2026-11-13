import { NextResponse } from "next/server";
import { hasReplicate } from "@/lib/replicate";

export const dynamic = "force-dynamic";

// Tells the page which features this deployment has turned on.
export function GET() {
  return NextResponse.json({
    paid: hasReplicate(),
    hfToken: Boolean(process.env.HF_TOKEN),
  });
}
