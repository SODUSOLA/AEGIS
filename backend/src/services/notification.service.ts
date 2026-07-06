import { sendEmail } from '../integrations/email/email.client';
import {
  DunningStartedEmailPayload,
  RetryScheduledEmailPayload,
  PaymentRecoveredEmailPayload,
  UpdateCardEmailPayload,
  SubscriptionSuspendedEmailPayload,
} from '../integrations/email/email.types';

// ─── Helpers ──────────────────────────────────────────

/** Formats a kobo amount as human-readable Nigerian Naira (e.g. "₦1,500.00"). */
function formatNaira(amountKobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amountKobo / 100);
}

/** Wraps body HTML inside the shared AEGIS billing email template. */
function wrapHtml(body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="max-width:600px;background:#ffffff;border-radius:8px;
                 padding:32px;border:1px solid #e5e7eb;">
          <tr>
            <td>
              <div style="margin-bottom:24px;">
                <span style="font-size:20px;font-weight:bold;color:#111827;">AEGIS</span>
                <span style="font-size:14px;color:#6b7280;margin-left:8px;">Billing Engine</span>
              </div>
              ${body}
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
              <p style="font-size:12px;color:#9ca3af;margin:0;">
                This is an automated billing notification from AEGIS.<br />
                If you have questions, please contact the merchant who manages your subscription.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// ─── Email Senders ────────────────────────────────────

/** Notifies the customer when the first payment attempt fails and dunning begins. */
export async function sendDunningStartedEmail(
  payload: DunningStartedEmailPayload,
): Promise<void> {
  const name = payload.customerName ?? 'there';
  const amount = formatNaira(payload.amountKobo);
  const retryText = payload.nextRetryHours === 1 ? '1 hour' : `${payload.nextRetryHours} hours`;

  const html = wrapHtml(`
    <h2 style="font-size:18px;color:#111827;margin:0 0 12px;">Payment Failed</h2>
    <p style="color:#374151;line-height:1.6;">Hi ${name},</p>
    <p style="color:#374151;line-height:1.6;">
      We attempted to charge <strong>${amount}</strong> for your
      <strong>${payload.planName}</strong> subscription, but the payment did not go through.
    </p>
    <p style="color:#374151;line-height:1.6;">
      We will automatically retry your payment in <strong>${retryText}</strong>.
      Please ensure your card has sufficient funds before then.
    </p>
    <div style="background:#fef3c7;border-radius:6px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#92400e;font-size:14px;">
        <strong>Action needed:</strong> If your card details have changed,
        please contact your service provider to update your payment method.
      </p>
    </div>
  `);

  await sendEmail({
    to: payload.customerEmail,
    subject: `Payment Failed — We'll Retry in ${retryText}`,
    html,
    text: `Hi ${name}, your payment of ${amount} for ${payload.planName} failed. We will retry in ${retryText}.`,
  });
}

/** Notifies the customer when a dunning retry attempt also fails. */
export async function sendRetryScheduledEmail(
  payload: RetryScheduledEmailPayload,
): Promise<void> {
  const name = payload.customerName ?? 'there';
  const amount = formatNaira(payload.amountKobo);
  const h = payload.nextRetryHours;
  const retryText = h < 24 ? `${h} hour${h > 1 ? 's' : ''}` : `${h / 24} day${h / 24 > 1 ? 's' : ''}`;

  const html = wrapHtml(`
    <h2 style="font-size:18px;color:#111827;margin:0 0 12px;">Payment Retry Attempt ${payload.attemptNumber} Failed</h2>
    <p style="color:#374151;line-height:1.6;">Hi ${name},</p>
    <p style="color:#374151;line-height:1.6;">
      We tried to charge <strong>${amount}</strong> for your
      <strong>${payload.planName}</strong> subscription again, but the payment was unsuccessful.
    </p>
    <p style="color:#374151;line-height:1.6;">
      We will make one more attempt in <strong>${retryText}</strong>.
    </p>
    <div style="background:#fee2e2;border-radius:6px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#991b1b;font-size:14px;">
        <strong>Urgent:</strong> Please update your payment method or ensure your card
        has sufficient funds before the next retry to avoid your subscription being paused.
      </p>
    </div>
  `);

  await sendEmail({
    to: payload.customerEmail,
    subject: `Payment Retry Failed — One More Attempt Remaining`,
    html,
    text: `Hi ${name}, payment retry ${payload.attemptNumber} for ${payload.planName} (${amount}) failed. We will try again in ${retryText}.`,
  });
}

/** Notifies the customer that a previously failed payment has now succeeded. */
export async function sendPaymentRecoveredEmail(
  payload: PaymentRecoveredEmailPayload,
): Promise<void> {
  const name = payload.customerName ?? 'there';
  const amount = formatNaira(payload.amountKobo);
  const nextDate = new Intl.DateTimeFormat('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(payload.nextBillingDate);

  const html = wrapHtml(`
    <h2 style="font-size:18px;color:#111827;margin:0 0 12px;">✅ Payment Successful</h2>
    <p style="color:#374151;line-height:1.6;">Hi ${name},</p>
    <p style="color:#374151;line-height:1.6;">
      Great news — your payment of <strong>${amount}</strong> for
      <strong>${payload.planName}</strong> was successful.
      Your subscription is now <strong>active</strong>.
    </p>
    <p style="color:#374151;line-height:1.6;">
      Your next billing date is <strong>${nextDate}</strong>.
    </p>
    <div style="background:#d1fae5;border-radius:6px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#065f46;font-size:14px;">
        Thank you for keeping your account up to date.
      </p>
    </div>
  `);

  await sendEmail({
    to: payload.customerEmail,
    subject: `Payment Successful — Subscription Active`,
    html,
    text: `Hi ${name}, your payment of ${amount} for ${payload.planName} was successful. Next billing date: ${nextDate}.`,
  });
}

/** Asks the customer to update their card after a permanent card failure. */
export async function sendUpdateCardEmail(
  payload: UpdateCardEmailPayload,
): Promise<void> {
  const name = payload.customerName ?? 'there';
  const reasonMessages: Record<string, string> = {
    EXPIRED_CARD: 'Your card has expired.',
    INVALID_CARD: 'Your card details are invalid.',
    DO_NOT_HONOR: 'Your bank declined the transaction.',
  };
  const reasonText = reasonMessages[payload.failureReason] ?? 'Your card could not be charged.';

  const html = wrapHtml(`
    <h2 style="font-size:18px;color:#111827;margin:0 0 12px;">Action Required — Update Your Card</h2>
    <p style="color:#374151;line-height:1.6;">Hi ${name},</p>
    <p style="color:#374151;line-height:1.6;">
      We were unable to process your payment for
      <strong>${payload.planName}</strong>. ${reasonText}
    </p>
    <p style="color:#374151;line-height:1.6;">
      Your subscription has been paused. To reactivate it, please contact
      your service provider and provide updated payment details.
    </p>
    <div style="background:#fee2e2;border-radius:6px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#991b1b;font-size:14px;">
        <strong>No further automatic retries will be made</strong> until your payment method is updated.
      </p>
    </div>
  `);

  await sendEmail({
    to: payload.customerEmail,
    subject: `Subscription Paused — Card Update Required`,
    html,
    text: `Hi ${name}, we could not charge your card for ${payload.planName}. ${reasonText} Please update your payment details.`,
  });
}

/** Notifies the customer that all retries were exhausted and the subscription is suspended. */
export async function sendSubscriptionSuspendedEmail(
  payload: SubscriptionSuspendedEmailPayload,
): Promise<void> {
  const name = payload.customerName ?? 'there';
  const attempts = payload.totalAttempts;

  const html = wrapHtml(`
    <h2 style="font-size:18px;color:#111827;margin:0 0 12px;">Subscription Paused</h2>
    <p style="color:#374151;line-height:1.6;">Hi ${name},</p>
    <p style="color:#374151;line-height:1.6;">
      We made <strong>${attempts} payment attempt${attempts > 1 ? 's' : ''}</strong>
      for your <strong>${payload.planName}</strong> subscription, but were unable to collect payment.
    </p>
    <p style="color:#374151;line-height:1.6;">
      Your subscription has been <strong>paused</strong>. To restore access,
      please contact your service provider to resolve your outstanding balance.
    </p>
    <div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#374151;font-size:14px;">
        Your subscription history and data are preserved and can be restored once payment is resolved.
      </p>
    </div>
  `);

  await sendEmail({
    to: payload.customerEmail,
    subject: `Subscription Paused After ${attempts} Failed Attempt${attempts > 1 ? 's' : ''}`,
    html,
    text: `Hi ${name}, we were unable to collect payment for ${payload.planName} after ${attempts} attempt(s). Your subscription has been paused.`,
  });
}
