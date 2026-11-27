import { folioServerEnabled } from "./serverMode";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { ApiClient, ApiError } from "@folio/api-client";
import type { Tokens, UserProfile } from "@folio/shared-types";
const base = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
export const useAuth = create<{
  user: UserProfile | null;
  token: string | null;
}>()(() => ({ user: null, token: null }));
export const api = new ApiClient(base, () => useAuth.getState().token);
let refreshing: Promise<void> | null = null;
async function accept(tokens: Tokens) {
  await SecureStore.setItemAsync("folio.refresh", tokens.refreshToken);
  useAuth.setState({ token: tokens.accessToken });
}
export async function signIn(email: string, password: string, name?: string) {
  if (!folioServerEnabled)
    throw new Error(
      "Use Google Drive backup in Profile. Folio accounts are disabled in this build.",
    );
  const result = await api.post<Tokens & { user: UserProfile }>(
    name ? "/auth/register" : "/auth/login",
    { email, password, ...(name ? { name } : {}) },
  );
  await accept(result);
  useAuth.setState({ user: result.user });
}
export async function refresh() {
  if (!folioServerEnabled)
    throw new Error(
      "Use Google Drive backup in Profile. Folio accounts are disabled in this build.",
    );

  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = await SecureStore.getItemAsync("folio.refresh");
    if (!refreshToken) throw new Error("Sign in to enable cloud backup.");
    await accept(await api.post<Tokens>("/auth/refresh", { refreshToken }));
    useAuth.setState({ user: await api.request<UserProfile>("/auth/me") });
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}
export async function authorized<T>(fn: () => Promise<T>): Promise<T> {
  if (!folioServerEnabled)
    throw new Error(
      "Use Google Drive backup in Profile. Folio accounts are disabled in this build.",
    );

  if (!useAuth.getState().token) await refresh();
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      await refresh();
      return fn();
    }
    throw e;
  }
}
export async function signOut() {
  try {
    if (useAuth.getState().token) await api.post("/auth/logout", {});
  } finally {
    await SecureStore.deleteItemAsync("folio.refresh");
    useAuth.setState({ user: null, token: null });
    const { useSettings } = await import("../../store");
    await useSettings.getState().change("backup", false);
  }
}
