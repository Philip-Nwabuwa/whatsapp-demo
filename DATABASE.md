# Database Configuration and Usage

This document describes the PostgreSQL database integration for phone number tracking and duplicate prevention.

## Overview

The application now includes PostgreSQL database functionality to:
- Store phone numbers with metadata
- Prevent duplicate numbers from being processed
- Track sending history and statistics
- Provide validation and management APIs

## Configuration

### Environment Variables

Add the following to your `.env.local` file:

```env
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
```

The `DATABASE_URL` should be a complete PostgreSQL connection string. The application supports SSL connections (recommended for production).

### Database Schema

The application automatically creates the following table structure:

```sql
CREATE TABLE phone_numbers (
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
```

## Database Migration

### Automatic Migration

The database schema is automatically created/updated when:
- The SMS sending API is called (`/api/sms/send`)
- Database management APIs are accessed
- The migration script is run

### Manual Migration

You can also run migrations manually:

```bash
# Run migrations
node scripts/migrate.js migrate

# Check migration status
node scripts/migrate.js status

# Reset database (development only)
node scripts/migrate.js reset --force
```

## API Endpoints

### SMS Sending with Database Integration

**POST** `/api/sms/send`

The existing SMS sending endpoint now includes database validation:

```json
{
  "phoneNumbers": ["+1234567890", "+0987654321"],
  "message": "Hello from WhatsApp!"
}
```

Response includes validation information:

```json
{
  "success": true,
  "data": {
    "totalSent": 1,
    "totalFailed": 0,
    "results": [...],
    "validation": {
      "total": 2,
      "valid": 2,
      "invalid": 0,
      "duplicates": 1,
      "new": 1
    },
    "invalidNumbers": [],
    "duplicateNumbers": ["+1234567890"],
    "newNumbers": ["+0987654321"]
  }
}
```

### Database Management

**GET** `/api/database/numbers`

Retrieve stored phone numbers with pagination:

Query parameters:
- `page` (default: 1)
- `limit` (default: 50, max: 100)
- `status` (all, active, blocked, invalid)
- `search` (search in phone numbers)

**POST** `/api/database/numbers`

Add phone numbers manually:

```json
{
  "phoneNumbers": ["+1234567890", "+0987654321"],
  "metadata": {
    "source": "manual_import",
    "campaign": "summer_2024"
  }
}
```

**DELETE** `/api/database/numbers`

Delete phone numbers:

```json
{
  "clearAll": true
}
```

Or delete specific numbers:

```json
{
  "phoneNumbers": ["+1234567890", "+0987654321"]
}
```

### Database Status

**GET** `/api/database/status`

Get database connection status and statistics:

```json
{
  "success": true,
  "status": {
    "connected": true,
    "schema": {
      "current": 1,
      "latest": 1,
      "upToDate": true
    },
    "statistics": {
      "total": 150,
      "active": 148,
      "blocked": 2,
      "recentlySent": 25
    }
  }
}
```

**POST** `/api/database/status`

Run database migrations manually.

## Phone Number Validation

### Normalization

Phone numbers are automatically normalized:
- Remove all non-digit characters except `+`
- Add `+` prefix if missing
- Convert `00` prefix to `+`

Examples:
- `+1 (234) 567-8900` → `+12345678900`
- `00441234567890` → `+441234567890`
- `1234567890` → `+1234567890`

### Validation Rules

- Must be 7-15 digits after normalization
- Must start with `+`
- Duplicates are detected using normalized numbers

## Features

### Duplicate Prevention

- All phone numbers are checked against the database before processing
- Duplicate numbers are logged but not rejected
- New numbers are automatically stored

### Send Tracking

- Last sent timestamp is updated after successful message delivery
- Send count is incremented for each successful send
- Statistics are available via API

### Error Handling

- Database connection failures are handled gracefully
- Migration errors are logged and reported
- API endpoints include detailed error information in development mode

## Development

### Local Setup

1. Set up a PostgreSQL database (local or cloud)
2. Add `DATABASE_URL` to `.env.local`
3. Run the application - migrations will run automatically

### Testing

Test database connection:

```bash
node scripts/migrate.js status
```

### Troubleshooting

Common issues:

1. **Connection failed**: Check `DATABASE_URL` format and credentials
2. **SSL errors**: Ensure `sslmode=require` for cloud databases
3. **Migration errors**: Check database permissions and connectivity

## Production Considerations

- Use connection pooling (already configured)
- Monitor database performance
- Set up regular backups
- Consider read replicas for high traffic
- Use environment-specific configurations

## Security

- Database credentials are stored in environment variables
- SSL connections are supported and recommended
- SQL injection protection through parameterized queries
- No sensitive data is logged in production mode
