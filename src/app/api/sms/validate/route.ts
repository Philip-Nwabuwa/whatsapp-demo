import { NextResponse } from "next/server";
import { getTwilioService } from "@/lib/twilio";

export async function GET() {
  try {
    const twilioService = getTwilioService();
    const isValid = await twilioService.validateCredentials();

    return NextResponse.json({
      success: true,
      valid: isValid,
      message: isValid
        ? "Twilio credentials are valid"
        : "Twilio credentials are invalid",
    });
  } catch (error) {
    console.error("Twilio validation error:", error);

    return NextResponse.json({
      success: false,
      valid: false,
      message: "Failed to validate Twilio credentials",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Method not allowed. Use GET to validate credentials." },
    { status: 405 }
  );
}
