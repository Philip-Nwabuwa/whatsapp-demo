import { NextRequest, NextResponse } from "next/server";
import { getTwilioService } from "@/lib/twilio";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumbers, message } = body;

    // Validation
    if (
      !phoneNumbers ||
      !Array.isArray(phoneNumbers) ||
      phoneNumbers.length === 0
    ) {
      return NextResponse.json(
        { error: "Phone numbers array is required and cannot be empty" },
        { status: 400 }
      );
    }

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Message is required and cannot be empty" },
        { status: 400 }
      );
    }

    if (message.length > 1600) {
      return NextResponse.json(
        { error: "Message is too long. Maximum length is 1600 characters." },
        { status: 400 }
      );
    }

    if (phoneNumbers.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 phone numbers allowed per request" },
        { status: 400 }
      );
    }

    // Initialize Twilio service
    const twilioService = getTwilioService();

    // Send bulk WhatsApp messages
    const result = await twilioService.sendBulkWhatsApp(
      phoneNumbers,
      message.trim()
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("SMS sending error:", error);

    if (
      error instanceof Error &&
      error.message.includes("Missing required Twilio")
    ) {
      return NextResponse.json(
        {
          error:
            "Twilio configuration is missing. Please check your environment variables.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send WhatsApp messages. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to send WhatsApp messages." },
    { status: 405 }
  );
}
