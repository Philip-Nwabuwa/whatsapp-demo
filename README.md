# Bulk WhatsApp Marketing Dashboard

A Next.js application for sending bulk marketing messages via WhatsApp using Twilio's WhatsApp Business API.

## Features

- 📱 **WhatsApp Integration**: Send messages through Twilio's WhatsApp Business API
- 📊 **Bulk Messaging**: Send to up to 100 recipients per request
- 📁 **CSV Upload**: Import phone numbers from CSV files
- 📈 **Analytics Dashboard**: Track delivery status and success rates
- 🔒 **Rate Limiting**: Respects Twilio API limits
- 💾 **Export Results**: Download results in CSV or JSON format
- 🎨 **Professional UI**: Clean, responsive design with Tailwind CSS

## Prerequisites

1. **Twilio Account**: Sign up at [Twilio Console](https://console.twilio.com/)
2. **WhatsApp Business API**: Set up WhatsApp sandbox or get approved sender
3. **Node.js**: Version 18 or higher
4. **pnpm**: Package manager (or npm/yarn)

## WhatsApp Setup

### Option 1: Twilio Sandbox (For Testing)

1. Go to [Twilio Console > WhatsApp > Sandbox](https://console.twilio.com/us1/develop/sms/whatsapp/sandbox)
2. Note your sandbox number (e.g., `+14155238886`)
3. To test, send "join [sandbox-keyword]" to the sandbox number from your WhatsApp

### Option 2: Production WhatsApp Business API

1. Apply for WhatsApp Business API approval through Twilio
2. Complete the verification process
3. Get your approved WhatsApp Business number

## Installation

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd demo
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Configure environment variables**:
   Copy `.env.example` to `.env.local` and fill in your credentials:

   ```env
   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/whatsapp_dashboard

   # Twilio Configuration
   TWILIO_ACCOUNT_SID=your_account_sid_here
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_WHATSAPP_NUMBER=+14155238886  # Your Twilio WhatsApp number

   # Optional: Rate limiting
   TWILIO_RATE_LIMIT_PER_SECOND=1
   TWILIO_RATE_LIMIT_PER_MINUTE=60
   ```

4. **Start the development server**:

   ```bash
   pnpm dev
   ```

5. **Open the application**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Compose Message**: Enter your marketing message (up to 1600 characters)
2. **Add Recipients**:
   - Upload a CSV file with phone numbers, or
   - Manually enter phone numbers (one per line)
3. **Send Messages**: Click "Send Bulk WhatsApp" to deliver messages
4. **View Results**: See delivery status, success/failure rates, and export data

## Phone Number Format

Use international format for phone numbers:

- ✅ `+1234567890`
- ✅ `+44123456789`
- ❌ `1234567890` (will be auto-converted to +1234567890)

## CSV File Format

Your CSV file should have phone numbers in the first column:

```csv
phone
+1234567890
+1987654321
+44123456789
```

Or with headers:

```csv
name,phone,email
John Doe,+1234567890,john@example.com
Jane Smith,+1987654321,jane@example.com
```

## API Endpoints

- `POST /api/sms/send` - Send bulk WhatsApp messages
- `GET /api/sms/validate` - Validate Twilio credentials

## Rate Limiting

The application includes built-in rate limiting to respect Twilio's API limits:

- Default: 1 message per second
- Configurable via environment variables
- Automatic retry with backoff

## Important Notes

### WhatsApp Business API Requirements

- Recipients must have opted in to receive messages from your business
- For sandbox testing, recipients must join your sandbox first
- Production requires WhatsApp Business API approval

### Message Templates

- For production use, you may need to use approved message templates
- Sandbox allows free-form messages for testing

### Compliance

- Ensure compliance with WhatsApp Business Policy
- Obtain proper consent from recipients
- Follow local regulations (GDPR, CAN-SPAM, etc.)

## Troubleshooting

### Common Issues

1. **"Invalid phone number format"**

   - Ensure numbers are in international format (+country code)
   - Remove any spaces or special characters

2. **"Twilio credentials are invalid"**

   - Check your Account SID and Auth Token
   - Verify environment variables are set correctly

3. **"Failed to send WhatsApp messages"**

   - Verify your WhatsApp number is correctly configured
   - Check if recipients have joined your sandbox (for testing)
   - Ensure you have sufficient Twilio credits

4. **Rate limiting errors**
   - Reduce the rate limit in environment variables
   - Check your Twilio account limits

## Development

Built with:

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Twilio SDK** - WhatsApp messaging
- **PapaParse** - CSV parsing

## License

This project is licensed under the MIT License.
