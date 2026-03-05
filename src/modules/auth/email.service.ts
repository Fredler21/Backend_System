/**
 * Email Service
 *
 * Handles sending transactional emails (password reset codes, phone verification, etc.)
 * Currently uses a queue-ready architecture with console logging fallback.
 * Replace the `sendEmail` implementation with your email provider (Resend, SendGrid, SES, etc.)
 */

import { env } from '../../config';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email job queue (in-memory for now, swap with BullMQ/Redis in production).
 */
const emailQueue: EmailPayload[] = [];
let isProcessing = false;

/**
 * Send an email. Enqueues the email for async processing.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  emailQueue.push(payload);
  processQueue();
}

/**
 * Process emails from the queue.
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (emailQueue.length > 0) {
    const email = emailQueue.shift();
    if (!email) break;

    try {
      await deliverEmail(email);
    } catch (error) {
      console.error('[Email] Failed to send email:', {
        to: email.to,
        subject: email.subject,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  isProcessing = false;
}

/**
 * Deliver a single email.
 * This is the integration point — replace with your provider.
 */
async function deliverEmail(payload: EmailPayload): Promise<void> {
  // In production, integrate with an email provider here.
  // For now, log the email for development/testing.
  console.log('[Email] ─────────────────────────────────────');
  console.log(`[Email] To:      ${payload.to}`);
  console.log(`[Email] Subject: ${payload.subject}`);
  console.log(`[Email] Body:    ${payload.text || '(HTML only)'}`);
  console.log('[Email] ─────────────────────────────────────');
}

// ─── Email Templates ────────────────────────────────────

/**
 * Send a password reset verification code.
 */
export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  const subject = 'Edlight — Password Reset Code';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Edlight Initiative</h1>
        <p style="color: #666; font-size: 14px; margin-top: 4px;">Password Reset</p>
      </div>

      <div style="background: #f8f9fa; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
        <p style="color: #333; font-size: 14px; margin: 0 0 16px;">Your password reset verification code is:</p>
        <div style="background: #1a1a2e; color: #fff; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 16px 24px; border-radius: 8px; display: inline-block;">
          ${code}
        </div>
        <p style="color: #888; font-size: 12px; margin-top: 16px;">This code expires in <strong>10 minutes</strong>.</p>
      </div>

      <div style="color: #888; font-size: 12px; line-height: 1.5;">
        <p>If you did not request a password reset, please ignore this email. Your account is safe.</p>
        <p>Do not share this code with anyone. Edlight staff will never ask for your verification code.</p>
      </div>
    </div>
  `;

  const text = `Edlight Password Reset\n\nYour verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`;

  await sendEmail({ to: email, subject, html, text });
}

/**
 * Send a phone verification code via email (or SMS when integrated).
 */
export async function sendPhoneVerificationCode(
  destination: string,
  code: string,
  method: 'email' | 'sms' = 'email',
): Promise<void> {
  if (method === 'sms') {
    // SMS integration point — replace with Twilio, AWS SNS, etc.
    console.log(`[SMS] Sending verification code ${code} to ${destination}`);
    return;
  }

  const subject = 'Edlight — Phone Verification Code';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Edlight Initiative</h1>
        <p style="color: #666; font-size: 14px; margin-top: 4px;">Phone Verification</p>
      </div>

      <div style="background: #f0fdf4; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
        <p style="color: #333; font-size: 14px; margin: 0 0 16px;">Your phone verification code is:</p>
        <div style="background: #16a34a; color: #fff; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 16px 24px; border-radius: 8px; display: inline-block;">
          ${code}
        </div>
        <p style="color: #888; font-size: 12px; margin-top: 16px;">This code expires in <strong>5 minutes</strong>.</p>
      </div>

      <div style="color: #888; font-size: 12px; line-height: 1.5;">
        <p>If you did not request this verification, please ignore this email.</p>
      </div>
    </div>
  `;

  const text = `Edlight Phone Verification\n\nYour verification code is: ${code}\n\nThis code expires in 5 minutes.`;

  await sendEmail({ to: destination, subject, html, text });
}
