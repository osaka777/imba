import { NextRequest } from 'next/server';

export type SupportUserContext = {
  userId?: number;
  userEmail?: string;
  userLogin?: string;
  balanceSummary?: string;
  isAuthenticated: boolean;
};

type UserPayload = {
  id?: number;
  email?: string;
  login?: string;
  balances?: Array<{ currencyCode?: string; amount?: string }>;
};

type BalancePayload = Array<{ currencyCode?: string; amount?: string }>;

function formatBalance(user: UserPayload | null, balances: BalancePayload | null): string | undefined {
  const list = balances?.length ? balances : user?.balances;
  if (!list?.length) return undefined;
  const rub = list.find((item) => item.currencyCode === 'RUB') || list[0];
  if (!rub?.amount) return undefined;
  const code = rub.currencyCode || 'RUB';
  return `${Number.parseFloat(rub.amount).toFixed(2)} ${code}`;
}

export async function resolveSupportUserContext(request: NextRequest): Promise<SupportUserContext> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { isAuthenticated: false };
  }

  const token = authHeader.slice(7);
  const backendUrl = (process.env.BACKEND_URL || 'http://backend:3000').replace(/\/$/, '');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    const [userRes, balanceRes] = await Promise.all([
      fetch(`${backendUrl}/api/user`, { headers, cache: 'no-store' }),
      fetch(`${backendUrl}/api/finance/balance`, { headers, cache: 'no-store' }),
    ]);

    if (!userRes.ok) {
      return { isAuthenticated: false };
    }

    const user = (await userRes.json()) as UserPayload;
    let balances: BalancePayload | null = null;
    if (balanceRes.ok) {
      balances = (await balanceRes.json()) as BalancePayload;
    }

    return {
      isAuthenticated: true,
      userId: user.id,
      userEmail: user.email,
      userLogin: user.login || user.email,
      balanceSummary: formatBalance(user, balances),
    };
  } catch {
    return { isAuthenticated: false };
  }
}
