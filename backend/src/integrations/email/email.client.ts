import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { SendEmailOptions } from './email.types';

// ─── SMTP Transporter (lazy singleton) ────────────────

let _transporter: Transporter | null = null;

/** Returns the cached SMTP transporter, creating it on first call. */
function getTransporter(): Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });

    logger.info('SMTP transporter initialized', {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
    });
  }
  return _transporter;
}

// ─── Public API ───────────────────────────────────────

/**
 * Sends a transactional email via the configured SMTP transport.
 * Failures are logged but never thrown — billing flow must not be blocked by email.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const transporter = getTransporter();
  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    logger.info('Email sent successfully', {
      toDomain: options.to.split('@')[1],
      subject: options.subject,
      messageId: info.messageId,
    });
  } catch (error) {
    logger.warn('Email send failed — billing continues', {
      subject: options.subject,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/** Verifies the SMTP connection is alive (used at startup / health-check). */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await getTransporter().verify();
    logger.info('SMTP connection verified');
    return true;
  } catch (error) {
    logger.warn('SMTP verification failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}

/** Gracefully closes the SMTP connection pool (e.g. during shutdown). */
export function closeEmailTransporter(): void {
  if (_transporter) {
    _transporter.close();
    _transporter = null;
    logger.info('SMTP transporter closed');
  }
}
