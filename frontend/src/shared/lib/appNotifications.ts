const STORAGE_KEY = 'trackedDepositOrders';
const NOTIFICATIONS_KEY = 'depositUiNotifications';
const GENERAL_READ_KEY = 'generalNotificationsRead';
const GENERAL_DISMISSED_KEY = 'generalNotificationsDismissed';
const GENERAL_UI_KEY = 'generalUiNotifications';

export type TrackedDepositOrder = {
  id: number;
  publicOrderId?: number;
  currency: 'KZT' | 'RUB';
  createdAt: number;
};

export type DepositNotification = {
  id: string;
  orderId: number;
  displayId: number;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
};

export type NotificationKind = 'personal' | 'general';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  linkUrl?: string;
};

export type NotificationTab = 'all' | 'personal' | 'general';

const dispatchUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('deposit-notifications-updated'));
  }
};

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const saveTrackedOrders = (items: TrackedDepositOrder[]) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / privacy errors
  }
};

export const getTrackedDepositOrders = (): TrackedDepositOrder[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const trackDepositOrder = (input: {
  id: number;
  publicOrderId?: number;
  currency: 'KZT' | 'RUB';
}) => {
  if (!canUseStorage()) return;
  const existing = getTrackedDepositOrders().filter(
    (item) => Number(item.id) !== Number(input.id),
  );
  saveTrackedOrders([
    {
      id: Number(input.id),
      publicOrderId: input.publicOrderId,
      currency: input.currency,
      createdAt: Date.now(),
    },
    ...existing,
  ]);

  const displayId = Number(input.publicOrderId ?? input.id);
  addDepositNotification({
    orderId: Number(input.id),
    displayId,
    title: `Заявка #${displayId} отправлена`,
    message: 'Платеж принят на проверку.',
  });
};

export const getDepositNotifications = (): DepositNotification[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveDepositNotifications = (items: DepositNotification[]) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    // ignore
  }
};

export const addDepositNotification = (input: {
  orderId: number;
  displayId: number;
  title: string;
  message: string;
}) => {
  if (!canUseStorage()) return;
  const exists = getDepositNotifications().some(
    (n) => n.orderId === input.orderId && n.title === input.title,
  );
  if (exists) return;

  const item: DepositNotification = {
    id: `${input.orderId}-${Date.now()}`,
    orderId: input.orderId,
    displayId: input.displayId,
    title: input.title,
    message: input.message,
    createdAt: Date.now(),
    read: false,
  };
  saveDepositNotifications([item, ...getDepositNotifications()]);
  dispatchUpdated();
};

const getGeneralReadIds = (): string[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(GENERAL_READ_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveGeneralReadIds = (ids: string[]) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(GENERAL_READ_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
};

const getGeneralDismissedIds = (): string[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(GENERAL_DISMISSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveGeneralDismissedIds = (ids: string[]) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(GENERAL_DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
};

const readGeneralNotificationsRaw = (): AppNotification[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(GENERAL_UI_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: AppNotification) => ({
      ...item,
      kind: 'general' as const,
    }));
  } catch {
    return [];
  }
};

export const getPersonalNotifications = (): AppNotification[] =>
  getDepositNotifications().map((n) => ({
    id: n.id,
    kind: 'personal' as const,
    title: n.title,
    message: n.message,
    createdAt: n.createdAt,
    read: n.read,
  }));

export const getGeneralNotifications = (): AppNotification[] => {
  const readIds = new Set(getGeneralReadIds());
  const dismissedIds = new Set(getGeneralDismissedIds());
  return readGeneralNotificationsRaw()
    .filter((item) => !dismissedIds.has(item.id))
    .map((item) => ({
      ...item,
      read: readIds.has(item.id),
    }));
};

export const setGeneralNotifications = (items: AppNotification[]) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(
      GENERAL_UI_KEY,
      JSON.stringify(items.slice(0, 30)),
    );
    dispatchUpdated();
  } catch {
    // ignore
  }
};

export const getAllAppNotifications = (): AppNotification[] => {
  const merged = [...getPersonalNotifications(), ...getGeneralNotifications()];
  return merged.sort((a, b) => b.createdAt - a.createdAt);
};

export const filterNotificationsByTab = (
  items: AppNotification[],
  tab: NotificationTab,
): AppNotification[] => {
  if (tab === 'personal') return items.filter((n) => n.kind === 'personal');
  if (tab === 'general') return items.filter((n) => n.kind === 'general');
  return items;
};

export const markNotificationRead = (id: string, kind: NotificationKind) => {
  if (!canUseStorage()) return;

  if (kind === 'personal') {
    saveDepositNotifications(
      getDepositNotifications().map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    );
  } else {
    const readIds = getGeneralReadIds();
    if (!readIds.includes(id)) {
      saveGeneralReadIds([...readIds, id]);
    }
  }

  dispatchUpdated();
};

export const markAllNotificationsRead = () => {
  if (!canUseStorage()) return;
  saveDepositNotifications(
    getDepositNotifications().map((n) => ({ ...n, read: true })),
  );
  const generalIds = getGeneralNotifications().map((n) => n.id);
  saveGeneralReadIds(generalIds);
  dispatchUpdated();
};

export const markAllNotificationsReadForTab = (tab: NotificationTab) => {
  if (!canUseStorage()) return;

  if (tab === 'all' || tab === 'personal') {
    saveDepositNotifications(
      getDepositNotifications().map((n) => ({ ...n, read: true })),
    );
  }
  if (tab === 'all' || tab === 'general') {
    const generalIds = getGeneralNotifications().map((n) => n.id);
    saveGeneralReadIds(generalIds);
  }

  dispatchUpdated();
};

export const deleteNotification = (id: string, kind: NotificationKind) => {
  if (!canUseStorage()) return;

  if (kind === 'personal') {
    saveDepositNotifications(
      getDepositNotifications().filter((n) => n.id !== id),
    );
  } else {
    const dismissed = getGeneralDismissedIds();
    if (!dismissed.includes(id)) {
      saveGeneralDismissedIds([...dismissed, id]);
    }
  }

  dispatchUpdated();
};

export const deleteAllNotificationsForTab = (tab: NotificationTab) => {
  if (!canUseStorage()) return;

  if (tab === 'all' || tab === 'personal') {
    saveDepositNotifications([]);
  }

  if (tab === 'all' || tab === 'general') {
    const dismissed = new Set(getGeneralDismissedIds());
    readGeneralNotificationsRaw().forEach((item) => dismissed.add(item.id));
    saveGeneralDismissedIds([...dismissed]);
  }

  dispatchUpdated();
};

export const subscribeNotificationsUpdated = (handler: () => void) => {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('deposit-notifications-updated', handler);
  return () => window.removeEventListener('deposit-notifications-updated', handler);
};

export const untrackDepositOrder = (id: number) => {
  if (!canUseStorage()) return;
  const next = getTrackedDepositOrders().filter(
    (item) => Number(item.id) !== Number(id),
  );
  saveTrackedOrders(next);
};

export type DepositResultPayload = {
  orderId: number;
  publicOrderId?: number;
  status: 'approved' | 'rejected' | 'expired';
  currency?: 'KZT' | 'RUB';
  amount?: number;
};

const DEPOSIT_RESULT_EVENT = 'deposit-result';

export const emitDepositResult = (payload: DepositResultPayload) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DEPOSIT_RESULT_EVENT, { detail: payload }));
};

export const subscribeDepositResults = (
  handler: (payload: DepositResultPayload) => void,
) => {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<DepositResultPayload>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(DEPOSIT_RESULT_EVENT, listener);
  return () => window.removeEventListener(DEPOSIT_RESULT_EVENT, listener);
};
