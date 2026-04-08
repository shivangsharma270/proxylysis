
export interface AgentSettings {
  glId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  authToken: string;
  productName: string;
  disputedAmount?: string;
  document?: File | null;
  disputedContactNumber?: string;
  mid?: string;
}

export interface ActivityLog {
  id?: string;
  date?: string;
  type?: string;
  amount?: number;
  status?: string;
  description?: string;
  [key: string]: any;
}

export interface JourneyStep {
  id: string;
  timestamp: Date;
  title: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  description?: string;
  data?: any;
}
