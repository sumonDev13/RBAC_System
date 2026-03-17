export type UserRole = 'admin' | 'manager' | 'agent' | 'customer';
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  manager_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Permission {
  id: string;
  atom: string;
  label: string;
  description: string | null;
  module: string;
}

export interface ResolvedPermission {
  permission_id: string;
  atom: string;
  module: string;
  granted: boolean;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  target_id: string | null;
  action: string;
  metadata: Record<string, any> | null;
  ip_address: string | null;
  created_at: Date;
}

// Augmented Express request
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userPermissions?: string[]; // resolved atom list
    }
  }
}