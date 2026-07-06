import { Merchant } from '@prisma/client';

/** Augment Express's Request with the authenticated merchant resolved from the API key. */
declare global {
  namespace Express {
    interface Request {
      merchant?: Merchant;
    }
  }
}

// Required to make this file a module (so the global augmentation applies correctly)
export {};
