interface RateLimiterOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

class RateLimiter {
  private requests: Map<string, RequestRecord[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  async checkLimit(identifier: string): Promise<{ allowed: boolean; resetTime?: number }> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create request history for this identifier
    let requestHistory = this.requests.get(identifier) || [];

    // Remove old requests outside the current window
    requestHistory = requestHistory.filter(record => record.timestamp > windowStart);

    // Count total requests in the current window
    const totalRequests = requestHistory.reduce((sum, record) => sum + record.count, 0);

    if (totalRequests >= this.maxRequests) {
      // Find the oldest request to determine when the limit resets
      const oldestRequest = requestHistory[0];
      const resetTime = oldestRequest ? oldestRequest.timestamp + this.windowMs : now + this.windowMs;
      
      return {
        allowed: false,
        resetTime
      };
    }

    // Add current request
    requestHistory.push({
      timestamp: now,
      count: 1
    });

    // Update the map
    this.requests.set(identifier, requestHistory);

    return { allowed: true };
  }

  async waitForLimit(identifier: string): Promise<void> {
    const result = await this.checkLimit(identifier);
    
    if (!result.allowed && result.resetTime) {
      const waitTime = result.resetTime - Date.now();
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // Clean up old entries periodically
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs * 2; // Keep some buffer

    for (const [identifier, history] of this.requests.entries()) {
      const filteredHistory = history.filter(record => record.timestamp > cutoff);
      
      if (filteredHistory.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, filteredHistory);
      }
    }
  }
}

// Create rate limiters for different Twilio API endpoints
export const twilioSMSRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: parseInt(process.env.TWILIO_RATE_LIMIT_PER_MINUTE || '60')
});

export const twilioPerSecondLimiter = new RateLimiter({
  windowMs: 1000, // 1 second
  maxRequests: parseInt(process.env.TWILIO_RATE_LIMIT_PER_SECOND || '1')
});

// Cleanup old entries every 5 minutes
setInterval(() => {
  twilioSMSRateLimiter.cleanup();
  twilioPerSecondLimiter.cleanup();
}, 5 * 60 * 1000);

export default RateLimiter;
