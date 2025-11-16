/**
 * ARTILLERY HELPER FUNCTIONS
 * 
 * Custom functions for Artillery load tests
 */

module.exports = {
  /**
   * Authenticate and set token in context
   */
  async authenticateUser(context, events, done) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const email = process.env.TEST_USER_EMAIL || 'loadtest@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword123';

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error(`Auth failed: ${response.status}`);
      }

      const data = await response.json();
      context.vars.token = data.access_token;
      
      return done();
    } catch (error) {
      console.error('Authentication failed:', error);
      return done(error);
    }
  },

  /**
   * Generate random delivery date (2-7 days from now)
   */
  setDeliveryDate(context, events, done) {
    const daysFromNow = Math.floor(Math.random() * 5) + 2;
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    context.vars.deliveryDate = date.toISOString();
    return done();
  },

  /**
   * Generate random cart ID
   */
  setCartId(context, events, done) {
    context.vars.cartId = `00000000-0000-0000-0000-00000000000${Math.floor(Math.random() * 9) + 1}`;
    return done();
  },

  /**
   * Log response time
   */
  logResponseTime(requestParams, response, context, ee, next) {
    console.log(`Response time: ${response.timings.phases.total}ms`);
    return next();
  }
};
