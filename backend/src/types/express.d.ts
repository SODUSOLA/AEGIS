import { Merchant } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      merchant?: Merchant;
    }
  }
}

export {};
