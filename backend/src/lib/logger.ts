import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

/** Colour-coded, human-readable format for local development. */
const developmentFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  simple(),
);

/** Structured JSON format for production log ingestion. */
const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

/** Application-wide Winston logger. Debug-level in dev, info-level in production. */
export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  transports: [
    new winston.transports.Console(),
  ],
  exitOnError: false,
});
