/**
 * reports-api.ts
 *
 * Functions for fetching data from the backend REST API.
 * Uses the shared axios instance so the base URL is configured in one place.
 */

import { api } from './axios-instance';
import { GetReportsResponse, ServerReport } from '../types';

/**
 * Fetches all reports that the server has received.
 * Called by the "All Reports" tab via TanStack Query.
 */
export async function fetchServerReports(): Promise<ServerReport[]> {
  const response = await api.get<GetReportsResponse>('/api/reports');
  return response.data.reports;
}
