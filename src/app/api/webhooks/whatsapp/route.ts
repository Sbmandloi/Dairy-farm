import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Webhook verification
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Webhook events (delivery receipts)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field === "messages") {
            for (const status of change.value?.statuses ?? []) {
              const msgId = status.id;
              const statusType = status.status; // sent, delivered, read, failed

              if (statusType === "delivered" || statusType === "read") {
                await prisma.bill.updateMany({
                  where: { whatsappMsgId: msgId },
                  data: { status: "SENT" },
                });
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
