/**
 * Application Types
 * Définitions pour les applications et SDK keys
 */

export interface Application {
  id: string;
  tenantId: string;
  name: string;
  platform: string;
  sdkKey: string;
  settings?: ApplicationSettings;
  createdAt: string;
  updatedAt: string;

  // Stats (si chargées)
  _count?: {
    tickets: number;
  };
}

export interface ApplicationSettings {
  recordVideo?: boolean;
  captureLogs?: boolean;
  maxVideoSize?: number;
  allowedDomains?: string[];
  webhookUrl?: string;
  autoAssign?: boolean;
  notifyOnNewTicket?: boolean;
}

export interface CreateApplicationData {
  name: string;
  platform: string;
  settings?: Partial<ApplicationSettings>;
}

export interface UpdateApplicationData {
  name?: string;
  platform?: string;
  settings?: Partial<ApplicationSettings>;
}

export interface ApplicationStats {
  id: string;
  name: string;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgResolutionTime?: number; // en heures
  lastTicketAt?: string;
}
