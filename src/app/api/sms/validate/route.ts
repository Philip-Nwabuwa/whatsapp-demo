import { NextResponse } from "next/server";
import { getTwilioService } from "@/lib/twilio";

export async function GET() {
  try {
    const twilioService = getTwilioService();

    const isValid = await twilioService.validateCredentials();

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Twilio credentials or configuration",
        },
        { status: 401 }
      );
    }

    // Get account info
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const fromNumber =
      process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;

    return NextResponse.json({
      success: true,
      message: "Twilio credentials are valid",
      config: {
        accountSid: accountSid ? `${accountSid.substring(0, 8)}...` : "Not set",
        fromNumber: fromNumber || "Not set",
        environment: accountSid?.startsWith("AC") ? "Live" : "Unknown",
      },
    });
  } catch (error) {
    console.error("Credential validation error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to validate credentials",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Method not allowed. Use GET to validate credentials." },
    { status: 405 }
  );
}
