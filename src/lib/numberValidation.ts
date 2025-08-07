import { query, transaction } from "./database";

export interface PhoneNumberRecord {
  id: number;
  phone_number: string;
  normalized_number: string;
  created_at: Date;
  updated_at: Date;
  last_sent_at: Date | null;
  send_count: number;
  status: "active" | "blocked" | "invalid";
  metadata: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  isDuplicate: boolean;
  normalizedNumber: string;
  existingRecord?: PhoneNumberRecord;
  error?: string;
}

export interface BulkValidationResult {
  validNumbers: string[];
  duplicateNumbers: string[];
  invalidNumbers: string[];
  newNumbers: string[];
  results: ValidationResult[];
  // Enhanced fields for intra-input duplicate handling
  totalInputNumbers: number;
  uniqueInputNumbers: string[];
  intraInputDuplicates: string[];
  databaseDuplicates: string[];
  uniqueNewNumbers: string[];
}

export interface TemplateSendRecord {
  id: number;
  phone_number_id: number;
  template_sid: string;
  template_name?: string;
  template_language: string;
  template_variables: string[];
  sent_at: Date;
  message_sid?: string;
  status: string;
  metadata: Record<string, any>;
}

/**
 * Normalize a phone number by removing all non-digit characters except +
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all characters except digits and +
  let normalized = phoneNumber.replace(/[^\d+]/g, "");

  // If it starts with +, keep it, otherwise add + if it doesn't start with it
  if (!normalized.startsWith("+")) {
    // If it starts with 00, replace with +
    if (normalized.startsWith("00")) {
      normalized = "+" + normalized.substring(2);
    } else if (normalized.length >= 10) {
      // Assume it's a local number and needs country code
      // This is a simple heuristic - in production you might want more sophisticated logic
      normalized = "+" + normalized;
    }
  }

  return normalized;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const normalized = normalizePhoneNumber(phoneNumber);

  // Basic validation: should start with + and have 7-15 digits
  const phoneRegex = /^\+\d{7,15}$/;
  return phoneRegex.test(normalized);
}

/**
 * Check if a phone number already exists in the database
 */
export async function checkNumberExists(
  phoneNumber: string
): Promise<PhoneNumberRecord | null> {
  const normalized = normalizePhoneNumber(phoneNumber);

  try {
    const result = await query<PhoneNumberRecord>(
      "SELECT * FROM phone_numbers WHERE normalized_number = $1",
      [normalized]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error("Error checking number existence:", error);
    throw new Error("Database error while checking number");
  }
}

/**
 * Validate a single phone number
 */
export async function validatePhoneNumber(
  phoneNumber: string
): Promise<ValidationResult> {
  try {
    // First check if the format is valid
    if (!isValidPhoneNumber(phoneNumber)) {
      return {
        isValid: false,
        isDuplicate: false,
        normalizedNumber: normalizePhoneNumber(phoneNumber),
        error: "Invalid phone number format",
      };
    }

    const normalizedNumber = normalizePhoneNumber(phoneNumber);

    // Check if it already exists in database
    const existingRecord = await checkNumberExists(phoneNumber);

    return {
      isValid: true,
      isDuplicate: existingRecord !== null,
      normalizedNumber,
      existingRecord: existingRecord || undefined,
    };
  } catch (error) {
    return {
      isValid: false,
      isDuplicate: false,
      normalizedNumber: normalizePhoneNumber(phoneNumber),
      error:
        error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

/**
 * Validate multiple phone numbers in bulk
 */
export async function validatePhoneNumbers(
  phoneNumbers: string[]
): Promise<BulkValidationResult> {
  const results: ValidationResult[] = [];
  const validNumbers: string[] = [];
  const duplicateNumbers: string[] = [];
  const invalidNumbers: string[] = [];
  const newNumbers: string[] = [];

  // Enhanced tracking for intra-input duplicates
  const totalInputNumbers = phoneNumbers.length;
  const uniqueInputNumbers = [...new Set(phoneNumbers)]; // Remove intra-input duplicates
  const intraInputDuplicates: string[] = [];
  const databaseDuplicates: string[] = [];
  const uniqueNewNumbers: string[] = [];

  // Find intra-input duplicates
  const numberCounts = new Map<string, number>();
  phoneNumbers.forEach((num) => {
    numberCounts.set(num, (numberCounts.get(num) || 0) + 1);
  });

  // Identify numbers that appear more than once in input
  numberCounts.forEach((count, number) => {
    if (count > 1) {
      // Add all instances of this duplicate number
      for (let i = 0; i < count; i++) {
        intraInputDuplicates.push(number);
      }
    }
  });

  // Process each unique number for database validation
  const uniqueResults = new Map<string, ValidationResult>();
  for (const phoneNumber of uniqueInputNumbers) {
    const result = await validatePhoneNumber(phoneNumber);
    uniqueResults.set(phoneNumber, result);
  }

  // Now process the original array to maintain order and count
  for (const phoneNumber of phoneNumbers) {
    const result = uniqueResults.get(phoneNumber)!;
    results.push(result);

    if (!result.isValid) {
      invalidNumbers.push(phoneNumber);
    } else if (result.isDuplicate) {
      duplicateNumbers.push(phoneNumber);
      validNumbers.push(phoneNumber);
      // Track unique database duplicates
      if (!databaseDuplicates.includes(phoneNumber)) {
        databaseDuplicates.push(phoneNumber);
      }
    } else {
      newNumbers.push(phoneNumber);
      validNumbers.push(phoneNumber);
      // Track unique new numbers
      if (!uniqueNewNumbers.includes(phoneNumber)) {
        uniqueNewNumbers.push(phoneNumber);
      }
    }
  }

  return {
    validNumbers,
    duplicateNumbers,
    invalidNumbers,
    newNumbers,
    results,
    // Enhanced fields
    totalInputNumbers,
    uniqueInputNumbers,
    intraInputDuplicates,
    databaseDuplicates,
    uniqueNewNumbers,
  };
}

/**
 * Store a new phone number in the database
 */
export async function storePhoneNumber(
  phoneNumber: string,
  metadata: Record<string, any> = {}
): Promise<PhoneNumberRecord> {
  const normalized = normalizePhoneNumber(phoneNumber);

  try {
    const result = await query<PhoneNumberRecord>(
      `INSERT INTO phone_numbers (phone_number, normalized_number, metadata)
       VALUES ($1, $2, $3)
       ON CONFLICT (phone_number) DO UPDATE SET
         updated_at = CURRENT_TIMESTAMP,
         metadata = $3
       RETURNING *`,
      [phoneNumber, normalized, JSON.stringify(metadata)]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error storing phone number:", error);
    throw new Error("Failed to store phone number in database");
  }
}

/**
 * Store multiple phone numbers in bulk
 */
export async function storePhoneNumbers(
  phoneNumbers: string[],
  metadata: Record<string, any> = {}
): Promise<PhoneNumberRecord[]> {
  if (phoneNumbers.length === 0) {
    return [];
  }

  try {
    return await transaction(async (client) => {
      const records: PhoneNumberRecord[] = [];

      for (const phoneNumber of phoneNumbers) {
        const normalized = normalizePhoneNumber(phoneNumber);

        const result = await client.query<PhoneNumberRecord>(
          `INSERT INTO phone_numbers (phone_number, normalized_number, metadata)
           VALUES ($1, $2, $3)
           ON CONFLICT (phone_number) DO UPDATE SET
             updated_at = CURRENT_TIMESTAMP,
             metadata = $3
           RETURNING *`,
          [phoneNumber, normalized, JSON.stringify(metadata)]
        );

        records.push(result.rows[0]);
      }

      return records;
    });
  } catch (error) {
    console.error("Error storing phone numbers in bulk:", error);
    throw new Error("Failed to store phone numbers in database");
  }
}

/**
 * Update the last sent timestamp for a phone number
 */
export async function updateLastSent(phoneNumber: string): Promise<void> {
  const normalized = normalizePhoneNumber(phoneNumber);

  try {
    await query(
      `UPDATE phone_numbers 
       SET last_sent_at = CURRENT_TIMESTAMP, 
           send_count = send_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE normalized_number = $1`,
      [normalized]
    );
  } catch (error) {
    console.error("Error updating last sent timestamp:", error);
    // Don't throw here as this is not critical for the main flow
  }
}

/**
 * Get statistics about stored phone numbers
 */
export async function getNumberStatistics(): Promise<{
  total: number;
  active: number;
  blocked: number;
  recentlySent: number;
}> {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked,
        COUNT(CASE WHEN last_sent_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recently_sent
      FROM phone_numbers
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      active: parseInt(row.active),
      blocked: parseInt(row.blocked),
      recentlySent: parseInt(row.recently_sent),
    };
  } catch (error) {
    console.error("Error getting number statistics:", error);
    return { total: 0, active: 0, blocked: 0, recentlySent: 0 };
  }
}

/**
 * Record a template send for tracking purposes
 */
export async function recordTemplateSend(
  phoneNumber: string,
  templateSid: string,
  templateName?: string,
  templateLanguage: string = "en",
  templateVariables: string[] = [],
  messageSid?: string,
  metadata: Record<string, any> = {}
): Promise<TemplateSendRecord | null> {
  try {
    // First, get the phone number record
    const phoneRecord = await checkNumberExists(phoneNumber);
    if (!phoneRecord) {
      console.error(
        "Cannot record template send: phone number not found in database"
      );
      return null;
    }

    const result = await query<TemplateSendRecord>(
      `INSERT INTO template_sends
       (phone_number_id, template_sid, template_name, template_language, template_variables, message_sid, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        phoneRecord.id,
        templateSid,
        templateName || null,
        templateLanguage,
        JSON.stringify(templateVariables),
        messageSid || null,
        JSON.stringify(metadata),
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error recording template send:", error);
    return null;
  }
}

/**
 * Check if a phone number has received a specific template
 */
export async function hasReceivedTemplate(
  phoneNumber: string,
  templateSid: string
): Promise<boolean> {
  try {
    const normalized = normalizePhoneNumber(phoneNumber);

    const result = await query(
      `SELECT COUNT(*) as count
       FROM template_sends ts
       JOIN phone_numbers pn ON ts.phone_number_id = pn.id
       WHERE pn.normalized_number = $1 AND ts.template_sid = $2`,
      [normalized, templateSid]
    );

    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error("Error checking template history:", error);
    return false;
  }
}

/**
 * Get template send history for a phone number
 */
export async function getTemplateSendHistory(
  phoneNumber: string
): Promise<TemplateSendRecord[]> {
  try {
    const normalized = normalizePhoneNumber(phoneNumber);

    const result = await query<TemplateSendRecord>(
      `SELECT ts.*
       FROM template_sends ts
       JOIN phone_numbers pn ON ts.phone_number_id = pn.id
       WHERE pn.normalized_number = $1
       ORDER BY ts.sent_at DESC`,
      [normalized]
    );

    return result.rows;
  } catch (error) {
    console.error("Error getting template send history:", error);
    return [];
  }
}

/**
 * Get numbers that have received a specific template
 */
export async function getNumbersWithTemplate(
  templateSid: string
): Promise<
  { phoneNumber: string; sentAt: Date; templateVariables: string[] }[]
> {
  try {
    const result = await query(
      `SELECT pn.phone_number, ts.sent_at, ts.template_variables
       FROM template_sends ts
       JOIN phone_numbers pn ON ts.phone_number_id = pn.id
       WHERE ts.template_sid = $1
       ORDER BY ts.sent_at DESC`,
      [templateSid]
    );

    return result.rows.map((row) => ({
      phoneNumber: row.phone_number,
      sentAt: row.sent_at,
      templateVariables: JSON.parse(row.template_variables || "[]"),
    }));
  } catch (error) {
    console.error("Error getting numbers with template:", error);
    return [];
  }
}
