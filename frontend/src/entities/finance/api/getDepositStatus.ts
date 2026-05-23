import { api } from "~/shared/api";

export interface DepositStatusResponse {
  id: string;
  externalId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export const getDepositStatus = async (depositId: string): Promise<DepositStatusResponse> => {
  const response = await api.GET(`/deposit/${depositId}/status`);
  return response.data;
};

export const getRecentDeposits = async (limit: number = 10): Promise<DepositStatusResponse[]> => {
  const response = await api.GET(`/deposit/recent?limit=${limit}`);
  return response.data;
};