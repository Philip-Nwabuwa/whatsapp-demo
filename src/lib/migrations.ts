import { query, transaction } from "./database";

/**
 * Database schema for phone numbers tracking
 */
export const SCHEMA_VERSION = 2;

/**
 * Create the phone_numbers table
 */
const CREATE_PHONE_NUMBERS_TABLE = `
  CREATE TABLE IF NOT EXISTS phone_numbers (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    normalized_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    send_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb
  );
`;

/**
 * Create the template_sends table for tracking template messages
 */
const CREATE_TEMPLATE_SENDS_TABLE = `
  CREATE TABLE IF NOT EXISTS template_sends (
    id SERIAL PRIMARY KEY,
    phone_number_id INTEGER NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
    template_sid VARCHAR(100) NOT NULL,
    template_name VARCHAR(255),
    template_language VARCHAR(10) DEFAULT 'en',
    template_variables JSONB DEFAULT '[]'::jsonb,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    message_sid VARCHAR(100),
    status VARCHAR(20) DEFAULT 'sent',
    metadata JSONB DEFAULT '{}'::jsonb
  );
`;

/**
 * Create indexes for better performance
 */
const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_phone_numbers_normalized ON phone_numbers(normalized_number);`,
  `CREATE INDEX IF NOT EXISTS idx_phone_numbers_created_at ON phone_numbers(created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_phone_numbers_last_sent_at ON phone_numbers(last_sent_at);`,
  `CREATE INDEX IF NOT EXISTS idx_phone_numbers_status ON phone_numbers(status);`,
];

/**
 * Create indexes for template_sends table
 */
const CREATE_TEMPLATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_template_sends_phone_number_id ON template_sends(phone_number_id);`,
  `CREATE INDEX IF NOT EXISTS idx_template_sends_template_sid ON template_sends(template_sid);`,
  `CREATE INDEX IF NOT EXISTS idx_template_sends_sent_at ON template_sends(sent_at);`,
  `CREATE INDEX IF NOT EXISTS idx_template_sends_status ON template_sends(status);`,
];

/**
 * Create the schema_version table to track migrations
 */
const CREATE_SCHEMA_VERSION_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
  );
`;

/**
 * Create a trigger to update the updated_at column
 */
const CREATE_UPDATED_AT_TRIGGER = `
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ language 'plpgsql';

  DROP TRIGGER IF EXISTS update_phone_numbers_updated_at ON phone_numbers;
  
  CREATE TRIGGER update_phone_numbers_updated_at
    BEFORE UPDATE ON phone_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
`;

/**
 * Run all database migrations
 */
export async function runMigrations(): Promise<void> {
  console.log("Starting database migrations...");

  try {
    await transaction(async (client) => {
      // Create schema version table first
      await client.query(CREATE_SCHEMA_VERSION_TABLE);

      // Check current schema version
      const versionResult = await client.query(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
      );

      const currentVersion =
        versionResult.rows.length > 0 ? versionResult.rows[0].version : 0;

      if (currentVersion >= SCHEMA_VERSION) {
        console.log(`Database is up to date (version ${currentVersion})`);
        return;
      }

      console.log(
        `Upgrading database from version ${currentVersion} to ${SCHEMA_VERSION}`
      );

      // Version 1: Create phone_numbers table and basic structure
      if (currentVersion < 1) {
        await client.query(CREATE_PHONE_NUMBERS_TABLE);
        console.log("✓ Created phone_numbers table");

        // Create indexes
        for (const indexQuery of CREATE_INDEXES) {
          await client.query(indexQuery);
        }
        console.log("✓ Created database indexes");

        // Create updated_at trigger
        await client.query(CREATE_UPDATED_AT_TRIGGER);
        console.log("✓ Created updated_at trigger");

        // Update schema version for v1
        await client.query(
          "INSERT INTO schema_version (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
          [1, "Initial schema with phone_numbers table"]
        );
      }

      // Version 2: Add template tracking
      if (currentVersion < 2) {
        await client.query(CREATE_TEMPLATE_SENDS_TABLE);
        console.log("✓ Created template_sends table");

        // Create template indexes
        for (const indexQuery of CREATE_TEMPLATE_INDEXES) {
          await client.query(indexQuery);
        }
        console.log("✓ Created template tracking indexes");

        // Update schema version for v2
        await client.query(
          "INSERT INTO schema_version (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
          [2, "Added template tracking functionality"]
        );
      }

      // Final schema version update
      await client.query(
        "INSERT INTO schema_version (version, description) VALUES ($1, $2) ON CONFLICT (version) DO UPDATE SET applied_at = CURRENT_TIMESTAMP",
        [SCHEMA_VERSION, "Latest schema with template tracking"]
      );

      console.log(
        `✓ Database migration completed successfully (version ${SCHEMA_VERSION})`
      );
    });
  } catch (error) {
    console.error("Database migration failed:", error);
    throw error;
  }
}

/**
 * Check if the database schema is up to date
 */
export async function checkSchemaVersion(): Promise<{
  current: number;
  latest: number;
  upToDate: boolean;
}> {
  try {
    const result = await query(
      "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
    );

    const currentVersion = result.rows.length > 0 ? result.rows[0].version : 0;

    return {
      current: currentVersion,
      latest: SCHEMA_VERSION,
      upToDate: currentVersion >= SCHEMA_VERSION,
    };
  } catch (error) {
    // If schema_version table doesn't exist, we're at version 0
    return {
      current: 0,
      latest: SCHEMA_VERSION,
      upToDate: false,
    };
  }
}

/**
 * Reset the database (for development/testing)
 */
export async function resetDatabase(): Promise<void> {
  console.log("Resetting database...");

  try {
    await transaction(async (client) => {
      await client.query("DROP TABLE IF EXISTS template_sends CASCADE");
      await client.query("DROP TABLE IF EXISTS phone_numbers CASCADE");
      await client.query("DROP TABLE IF EXISTS schema_version CASCADE");
      await client.query(
        "DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE"
      );
      console.log("✓ Database reset completed");
    });
  } catch (error) {
    console.error("Database reset failed:", error);
    throw error;
  }
}
