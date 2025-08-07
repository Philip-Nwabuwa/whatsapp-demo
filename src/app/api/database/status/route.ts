import { NextResponse } from "next/server";
import { testConnection } from "@/lib/database";
import { checkSchemaVersion, runMigrations } from "@/lib/migrations";
import { getNumberStatistics } from "@/lib/numberValidation";

/**
 * GET /api/database/status - Get database status and statistics
 */
export async function GET() {
  try {
    // Test database connection
    const isConnected = await testConnection();
    
    if (!isConnected) {
      return NextResponse.json(
        {
          success: false,
          error: "Database connection failed",
          status: {
            connected: false,
            schema: null,
            statistics: null,
          },
        },
        { status: 503 }
      );
    }

    // Check schema version
    const schemaInfo = await checkSchemaVersion();
    
    // Get statistics if schema is up to date
    let statistics = null;
    if (schemaInfo.upToDate) {
      try {
        statistics = await getNumberStatistics();
      } catch (error) {
        console.error("Error getting statistics:", error);
        // Continue without statistics
      }
    }

    return NextResponse.json({
      success: true,
      status: {
        connected: true,
        schema: schemaInfo,
        statistics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Database status check error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check database status",
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/database/status - Run database migrations
 */
export async function POST() {
  try {
    await runMigrations();
    
    // Get updated status
    const schemaInfo = await checkSchemaVersion();
    const statistics = await getNumberStatistics();

    return NextResponse.json({
      success: true,
      message: "Database migrations completed successfully",
      status: {
        connected: true,
        schema: schemaInfo,
        statistics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Database migration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run database migrations",
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}
