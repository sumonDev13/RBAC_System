import { User as AppUser } from ".";

declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}