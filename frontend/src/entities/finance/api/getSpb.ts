import { api } from "~/shared/api";

export const getSpb = async () => {
  const { data: banks } = await api.GET("/api/payment-system/bova/spb-banks");
  return banks;
};
