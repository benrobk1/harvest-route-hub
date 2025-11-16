/**
 * Utility functions for edge functions
 */

/**
 * Masks an email address for safe logging by showing only the first and last
 * character with asterisks in between. This prevents logging PII while still
 * providing some context for debugging.
 *
 * @param email - The email address to mask
 * @returns Masked email string (e.g., "u****r@example.com")
 *
 * @example
 * maskEmail("user@example.com") // "u****r@example.com"
 * maskEmail("a@b.com") // "a****@b.com"
 */
export function maskEmail(email: string): string {
  if (!email || email.length === 0) {
    return "";
  }

  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    // If it's not a valid email format, mask the whole thing
    return email.length > 2
      ? `${email[0]}****${email[email.length - 1]}`
      : "****";
  }

  // Mask local part
  const maskedLocal =
    localPart.length <= 2
      ? `${localPart[0]}****`
      : `${localPart[0]}****${localPart[localPart.length - 1]}`;

  return `${maskedLocal}@${domain}`;
}

/**
 * Truncates a message for safe logging by limiting it to a specified length
 * and adding an ellipsis. This prevents logging sensitive message content
 * while providing some context for debugging.
 *
 * @param message - The message to truncate
 * @param maxLength - Maximum length before truncation (default: 20)
 * @returns Truncated message with "..." appended if truncated
 *
 * @example
 * truncateMessage("This is a long message", 10) // "This is a ..."
 * truncateMessage("Short", 10) // "Short"
 */
export function truncateMessage(message: string, maxLength = 20): string {
  if (!message || message.length === 0) {
    return "";
  }

  if (message.length <= maxLength) {
    return message;
  }

  return `${message.substring(0, maxLength)}...`;
}
