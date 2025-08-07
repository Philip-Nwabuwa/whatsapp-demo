import { NextRequest, NextResponse } from "next/server";
import { runMigrations } from "@/lib/migrations";
import { validatePhoneNumbers } from "@/lib/numberValidation";

/**
 * POST /api/sms/validate-numbers - Validate phone numbers and check for duplicates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumbers } = body;

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

    if (phoneNumbers.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 phone numbers allowed per request" },
        { status: 400 }
      );
    }

    // Ensure database is set up
    try {
      await runMigrations();
    } catch (dbError) {
      console.error("Database migration error:", dbError);
      return NextResponse.json(
        { error: "Database setup failed. Please try again." },
        { status: 500 }
      );
    }

    // Validate phone numbers and check for duplicates
    let validationResult;
    try {
      validationResult = await validatePhoneNumbers(phoneNumbers);
    } catch (validationError) {
      console.error("Phone number validation error:", validationError);
      return NextResponse.json(
        { error: "Phone number validation failed. Please try again." },
        { status: 500 }
      );
    }

    // Report validation results with enhanced duplicate tracking
    const validationSummary = {
      total: validationResult.totalInputNumbers,
      valid: validationResult.validNumbers.length,
      invalid: validationResult.invalidNumbers.length,
      duplicates: validationResult.duplicateNumbers.length,
      new: validationResult.newNumbers.length,
      // Enhanced fields
      uniqueInput: validationResult.uniqueInputNumbers.length,
      intraInputDuplicates: validationResult.intraInputDuplicates.length,
      databaseDuplicates: validationResult.databaseDuplicates.length,
      uniqueNew: validationResult.uniqueNewNumbers.length,
    };

    return NextResponse.json({
      success: true,
      validation: validationSummary,
      duplicateNumbers: validationResult.duplicateNumbers,
      invalidNumbers: validationResult.invalidNumbers,
      newNumbers: validationResult.newNumbers,
      validNumbers: validationResult.validNumbers,
      // Enhanced fields for better duplicate handling
      uniqueInputNumbers: validationResult.uniqueInputNumbers,
      intraInputDuplicates: validationResult.intraInputDuplicates,
      databaseDuplicates: validationResult.databaseDuplicates,
      uniqueNewNumbers: validationResult.uniqueNewNumbers,
    });
  } catch (error) {
    console.error("Number validation error:", error);

    // Database-related errors
    if (error instanceof Error) {
      if (error.message.includes("DATABASE_URL")) {
        return NextResponse.json(
          {
            error:
              "Database configuration is missing. Please check your environment variables.",
          },
          { status: 500 }
        );
      }

      if (
        error.message.includes("database") ||
        error.message.includes("connection")
      ) {
        return NextResponse.json(
          {
            error: "Database connection failed. Please try again later.",
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to validate phone numbers. Please try again.",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to validate phone numbers." },
    { status: 405 }
  );
}
