import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin } = body;

    // Validate PIN format
    if (!pin || typeof pin !== "string") {
      return NextResponse.json(
        { success: false, error: "PIN is required" },
        { status: 400 }
      );
    }

    if (pin.length !== 6) {
      return NextResponse.json(
        { success: false, error: "PIN must be exactly 6 digits" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: "PIN must contain only numbers" },
        { status: 400 }
      );
    }

    // Get the correct PIN from environment variable
    const correctPin = process.env.DASHBOARD_PIN;

    if (!correctPin) {
      console.error("DASHBOARD_PIN environment variable is not set");
      return NextResponse.json(
        { success: false, error: "Authentication service not configured" },
        { status: 500 }
      );
    }

    // Verify PIN
    if (pin === correctPin) {
      return NextResponse.json({
        success: true,
        message: "Authentication successful",
      });
    } else {
      // Add a small delay to prevent brute force attacks
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return NextResponse.json(
        { success: false, error: "Invalid PIN" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to verify PIN." },
    { status: 405 }
  );
}
