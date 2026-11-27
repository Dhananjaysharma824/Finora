export interface HealthResponse {
  status: 'ok';
  service: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}
