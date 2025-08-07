import { NextRequest, NextResponse } from "next/server";
import { getTwilioService } from "@/lib/twilio";
import { runMigrations } from "@/lib/migrations";
import {
  validatePhoneNumbers,
  storePhoneNumbers,
  updateLastSent,
  recordTemplateSend,
} from "@/lib/numberValidation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      phoneNumbers,
      message,
      template,
      templateName,
      templateLanguage = "en",
      templateVariables,
    } = body;

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

    // Either message OR template must be provided
    if (!message && !template && !templateName) {
      return NextResponse.json(
        { error: "Either message or template must be provided" },
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

    // Report validation results
    const validationSummary = {
      total: phoneNumbers.length,
      valid: validationResult.validNumbers.length,
      invalid: validationResult.invalidNumbers.length,
      duplicates: validationResult.duplicateNumbers.length,
      new: validationResult.newNumbers.length,
    };

    console.log("Phone number validation summary:", validationSummary);

    // If there are invalid numbers, include them in the response
    if (validationResult.invalidNumbers.length > 0) {
      console.warn(
        "Invalid phone numbers found:",
        validationResult.invalidNumbers
      );
    }

    // If there are duplicate numbers, log them
    if (validationResult.duplicateNumbers.length > 0) {
      console.log(
        "Duplicate phone numbers found:",
        validationResult.duplicateNumbers
      );
    }

    // Store new phone numbers in the database
    if (validationResult.newNumbers.length > 0) {
      try {
        await storePhoneNumbers(validationResult.newNumbers, {
          source: "bulk_send",
          timestamp: new Date().toISOString(),
        });
        console.log(
          `Stored ${validationResult.newNumbers.length} new phone numbers`
        );
      } catch (storeError) {
        console.error("Error storing new phone numbers:", storeError);
        // Continue with sending even if storage fails
      }
    }

    // Use only valid numbers for sending
    const numbersToSend = validationResult.validNumbers;

    if (numbersToSend.length === 0) {
      return NextResponse.json(
        {
          error: "No valid phone numbers to send to",
          validation: validationSummary,
          invalidNumbers: validationResult.invalidNumbers,
        },
        { status: 400 }
      );
    }

    // Initialize Twilio service
    const twilioService = getTwilioService();

    let options: any = {};

    if (template || templateName) {
      // Template message
      options.template = {
        templateName: templateName || template?.name,
        templateLanguage: templateLanguage || template?.language || "en",
      };

      // Only add variables if they exist and are not empty
      const vars = templateVariables || template?.variables;
      if (vars && vars.length > 0) {
        options.template.templateVariables = vars;
      }
    } else {
      // Freeform message
      if (message.length > 1600) {
        return NextResponse.json(
          { error: "Message is too long. Maximum length is 1600 characters." },
          { status: 400 }
        );
      }
      options.message = message.trim();
    }

    // Send bulk WhatsApp messages using validated numbers
    const result = await twilioService.sendBulkWhatsApp(numbersToSend, options);

    // Update last sent timestamp and record template sends for successfully sent messages
    if (result.results) {
      const successfulNumbers = result.results
        .filter((r) => r.success)
        .map((r) => r.phoneNumber);

      // Update last sent timestamp for successful sends (don't await to avoid blocking response)
      Promise.all(
        successfulNumbers.map((number) =>
          updateLastSent(number).catch((err) =>
            console.error(`Failed to update last sent for ${number}:`, err)
          )
        )
      );

      // Record template sends if this was a template message
      if (templateName) {
        const templateVariablesArray = (templateVariables || []).filter(
          (v) => v.trim() !== ""
        );

        Promise.all(
          result.results
            .filter((r) => r.success)
            .map((r) =>
              recordTemplateSend(
                r.phoneNumber,
                templateName,
                undefined, // template friendly name - we could fetch this from templates
                templateLanguage,
                templateVariablesArray,
                r.messageId,
                {
                  source: "bulk_send",
                  timestamp: new Date().toISOString(),
                }
              ).catch((err) =>
                console.error(
                  `Failed to record template send for ${r.phoneNumber}:`,
                  err
                )
              )
            )
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        validation: validationSummary,
        invalidNumbers: validationResult.invalidNumbers,
        duplicateNumbers: validationResult.duplicateNumbers,
        newNumbers: validationResult.newNumbers,
      },
    });
  } catch (error) {
    console.error("SMS sending error:", error);

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

      if (error.message.includes("Missing required Twilio")) {
        return NextResponse.json(
          {
            error:
              "Twilio configuration is missing. Please check your environment variables.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to send WhatsApp messages. Please try again.",
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
    { error: "Method not allowed. Use POST to send WhatsApp messages." },
    { status: 405 }
  );
}
