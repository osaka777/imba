import { api } from "~/shared/api";

export const getSubcategoryCounts = async () => {
  const { data } = await api.GET("/api/subcategoryCounts", {});
  return data || {};
};

export const getLiveSubcategoryCounts = async () => {
  const { data } = await api.GET("/api/liveSubcategoryCounts", {});
  return data || {};
};

export const getPrematchSubcategoryCounts = async () => {
  const { data } = await api.GET("/api/prematchSubcategoryCounts", {});
  return data || {};
};