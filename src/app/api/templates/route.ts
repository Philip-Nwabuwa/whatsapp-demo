import { NextResponse } from "next/server";
import twilio from "twilio";

export async function GET() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: "Missing Twilio credentials" },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    // Fetch all content templates
    const contents = await client.content.v1.contents.list();

    // Format the templates for the UI
    const templates = contents.map((content: any) => ({
      sid: content.sid,
      friendlyName: content.friendlyName,
      language: content.language,
      dateCreated: content.dateCreated,
      dateUpdated: content.dateUpdated,
      types: Object.keys(content.types || {}),
    }));

    return NextResponse.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch templates",
      },
      { status: 500 }
    );
  }
}
