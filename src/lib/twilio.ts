import twilio from "twilio";
import { twilioSMSRateLimiter, twilioPerSecondLimiter } from "./rateLimiter";

export interface WhatsAppResult {
  phoneNumber: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkWhatsAppResult {
  totalSent: number;
  totalFailed: number;
  results: WhatsAppResult[];
}

export interface TemplateMessage {
  templateName: string;
  templateLanguage?: string;
  templateVariables?: string[];
}

export interface MessageOptions {
  message?: string;
  template?: TemplateMessage;
}

class TwilioService {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber =
      process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Missing required Twilio environment variables");
    }

    this.client = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  async sendWhatsApp(
    to: string,
    options: MessageOptions
  ): Promise<WhatsAppResult> {
    try {
      // Clean and validate phone number
      const cleanedNumber = this.cleanPhoneNumber(to);
      if (!this.isValidPhoneNumber(cleanedNumber)) {
        return {
          phoneNumber: to,
          success: false,
          error: "Invalid phone number format",
        };
      }

      // Apply rate limiting
      await twilioPerSecondLimiter.waitForLimit("whatsapp");
      await twilioSMSRateLimiter.waitForLimit("whatsapp");

      let messagePayload: any = {
        from: `whatsapp:${this.fromNumber}`,
        to: `whatsapp:${cleanedNumber}`,
      };

      // Check if sending template or freeform message
      if (options.template) {
        // Template message (for outside 24-hour window)
        // For Twilio Content API templates, use contentSid (starts with HX)
        messagePayload.contentSid = options.template.templateName;

        // For Content API templates, variables are passed differently
        if (
          options.template.templateVariables &&
          options.template.templateVariables.length > 0
        ) {
          const variablesObj: { [key: string]: string } = {};
          options.template.templateVariables.forEach((variable, index) => {
            variablesObj[(index + 1).toString()] = variable;
          });
          messagePayload.contentVariables = JSON.stringify(variablesObj);
        }
      } else if (options.message) {
        // Freeform message (only works inside 24-hour window)
        messagePayload.body = options.message;
      } else {
        throw new Error("Either message or template must be provided");
      }

      const result = await this.client.messages.create(messagePayload);

      return {
        phoneNumber: to,
        success: true,
        messageId: result.sid,
      };
    } catch (error) {
      // Handle specific WhatsApp window error
      if (error instanceof Error && error.message.includes("63016")) {
        return {
          phoneNumber: to,
          success: false,
          error:
            "Outside 24-hour window. Use a message template instead of freeform message.",
        };
      }

      return {
        phoneNumber: to,
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async sendFreeformWhatsApp(
    to: string,
    message: string
  ): Promise<WhatsAppResult> {
    return this.sendWhatsApp(to, { message });
  }

  async sendTemplateWhatsApp(
    to: string,
    templateName: string,
    templateLanguage: string = "en",
    templateVariables?: string[]
  ): Promise<WhatsAppResult> {
    return this.sendWhatsApp(to, {
      template: {
        templateName,
        templateLanguage,
        templateVariables,
      },
    });
  }

  async sendBulkWhatsApp(
    phoneNumbers: string[],
    options: MessageOptions
  ): Promise<BulkWhatsAppResult> {
    const results: WhatsAppResult[] = [];
    let totalSent = 0;
    let totalFailed = 0;

    for (const phoneNumber of phoneNumbers) {
      const result = await this.sendWhatsApp(phoneNumber, options);
      results.push(result);

      if (result.success) {
        totalSent++;
      } else {
        totalFailed++;
      }
    }

    return {
      totalSent,
      totalFailed,
      results,
    };
  }

  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, "");

    // If it starts with 1 and has 11 digits, add +
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      cleaned = "+" + cleaned;
    }
    // If it has 10 digits, assume US number and add +1
    else if (cleaned.length === 10) {
      cleaned = "+1" + cleaned;
    }
    // If it doesn't start with +, add it
    else if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }

    return cleaned;
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic validation for international phone numbers
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  // Method to validate Twilio credentials
  async validateCredentials(): Promise<boolean> {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      if (!accountSid) return false;

      await this.client.api.accounts(accountSid).fetch();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let twilioService: TwilioService | null = null;

export function getTwilioService(): TwilioService {
  if (!twilioService) {
    twilioService = new TwilioService();
  }
  return twilioService;
}

export default TwilioService;
