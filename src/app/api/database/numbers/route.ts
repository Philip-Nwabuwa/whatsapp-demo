import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/database";
import { getNumberStatistics, PhoneNumberRecord } from "@/lib/numberValidation";
import { runMigrations } from "@/lib/migrations";

/**
 * GET /api/database/numbers - Get stored phone numbers with pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Ensure database is set up
    await runMigrations();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100); // Max 100 per page
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = "";
    const queryParams: (string | number)[] = [];
    let paramIndex = 1;

    if (status !== "all") {
      whereClause += `WHERE status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (search) {
      const searchClause = `${
        whereClause ? "AND" : "WHERE"
      } (phone_number ILIKE $${paramIndex} OR normalized_number ILIKE $${paramIndex})`;
      whereClause += ` ${searchClause}`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM phone_numbers ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const dataResult = await query(
      `SELECT 
        id, phone_number, normalized_number, created_at, updated_at, 
        last_sent_at, send_count, status, metadata
       FROM phone_numbers 
       ${whereClause}
       ORDER BY created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    // Get statistics
    const stats = await getNumberStatistics();

    return NextResponse.json({
      success: true,
      data: {
        numbers: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        statistics: stats,
      },
    });
  } catch (error) {
    console.error("Error fetching phone numbers:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch phone numbers",
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

/**
 * DELETE /api/database/numbers - Clear all phone numbers or specific ones
 */
export async function DELETE(request: NextRequest) {
  try {
    // Ensure database is set up
    await runMigrations();

    const body = await request.json().catch(() => ({}));
    const { phoneNumbers, clearAll } = body;

    if (clearAll === true) {
      // Clear all numbers
      const result = await query("DELETE FROM phone_numbers");
      return NextResponse.json({
        success: true,
        message: `Cleared ${result.rowCount} phone numbers from database`,
        deletedCount: result.rowCount,
      });
    } else if (phoneNumbers && Array.isArray(phoneNumbers)) {
      // Delete specific numbers
      if (phoneNumbers.length === 0) {
        return NextResponse.json(
          { error: "No phone numbers provided for deletion" },
          { status: 400 }
        );
      }

      const placeholders = phoneNumbers
        .map((_, index) => `$${index + 1}`)
        .join(",");
      const result = await query(
        `DELETE FROM phone_numbers WHERE phone_number IN (${placeholders})`,
        phoneNumbers
      );

      return NextResponse.json({
        success: true,
        message: `Deleted ${result.rowCount} phone numbers from database`,
        deletedCount: result.rowCount,
      });
    } else {
      return NextResponse.json(
        {
          error:
            "Either 'clearAll: true' or 'phoneNumbers' array must be provided",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error deleting phone numbers:", error);
    return NextResponse.json(
      {
        error: "Failed to delete phone numbers",
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

/**
 * POST /api/database/numbers - Add phone numbers manually
 */
export async function POST(request: NextRequest) {
  try {
    // Ensure database is set up
    await runMigrations();

    const body = await request.json();
    const { phoneNumbers, metadata = {} } = body;

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

    // Import the validation functions
    const { validatePhoneNumbers, storePhoneNumbers } = await import(
      "@/lib/numberValidation"
    );

    // Validate phone numbers
    const validationResult = await validatePhoneNumbers(phoneNumbers);

    // Store new numbers
    let storedNumbers: PhoneNumberRecord[] = [];
    if (validationResult.newNumbers.length > 0) {
      storedNumbers = await storePhoneNumbers(validationResult.newNumbers, {
        ...metadata,
        source: "manual_add",
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        stored: storedNumbers,
        validation: {
          total: phoneNumbers.length,
          valid: validationResult.validNumbers.length,
          invalid: validationResult.invalidNumbers.length,
          duplicates: validationResult.duplicateNumbers.length,
          new: validationResult.newNumbers.length,
        },
        invalidNumbers: validationResult.invalidNumbers,
        duplicateNumbers: validationResult.duplicateNumbers,
      },
    });
  } catch (error) {
    console.error("Error adding phone numbers:", error);
    return NextResponse.json(
      {
        error: "Failed to add phone numbers",
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
