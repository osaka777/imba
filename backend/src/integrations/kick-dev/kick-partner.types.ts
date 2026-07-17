export type KickPartnerMeta = {
  channelSlug?: string | null;
  channelTitle?: string | null;
  channelAvatarUrl?: string | null;
  broadcasterUserId?: number | null;
  connectedAt?: string | null;
  scopes?: string | null;
  tokenExpiresAt?: string | null;
  tokenRefreshFailedAt?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  isLive?: boolean | null;
  viewerCount?: number | null;
  streamTitle?: string | null;
  customTags?: string[] | null;
  hasBranding?: boolean | null;
  activeSessionId?: string | null;
  lastLiveAt?: string | null;
  onboarding?: {
    linkDone?: boolean;
    obsDone?: boolean;
    linkDoneAt?: string | null;
    obsDoneAt?: string | null;
  };
  retention?: {
    lastNudgeAt?: string | null;
    lastNudgeType?: string | null;
    referralUnlockNotifiedAt?: string | null;
  };
  streamStats?: {
    todayClicks?: number;
    todayDay?: string | null;
    sessionId?: string | null;
    sessionClicks?: number;
  };
  widgetAlerts?: Array<{
    id: string;
    type: 'registration' | 'ftd';
    createdAt: string;
    label: string;
  }>;
  weeklyChallenge?: {
    weekKey?: string | null;
    grantedAt?: string | null;
  };
  streakBonus?: {
    lastGrantSessionId?: string | null;
    grantedAt?: string | null;
  };
  monthSprint?: {
    monthKey?: string | null;
    grantedAt?: string | null;
  };
  lastRegChatAt?: string | null;
  guessContest?: {
    sessionId?: string | null;
    matchId?: string | null;
    matchLabel?: string | null;
    guesses?: Array<{
      username: string;
      senderUserId: number;
      home: number;
      away: number;
      createdAt: string;
    }>;
  };
};

export type KickPartnerPublicStatus = {
  connected: boolean;
  configured: boolean;
  channelSlug: string | null;
  channelTitle: string | null;
  connectedAt: string | null;
  isLive: boolean | null;
  viewerCount: number | null;
  streamTitle: string | null;
  hasBranding: boolean | null;
  compliantHours30d: number;
  tokenRefreshFailedAt: string | null;
  activeSessionId: string | null;
  connectBonusGranted: boolean;
  connectBonusLocked: boolean;
  referralsCount: number;
  welcomeProgress: {
    stepConnect: boolean;
    stepBonus: boolean;
    stepReferral: boolean;
    stepWithdraw: boolean;
    availableUsd: number;
    lockedUsd: number;
    minWithdrawUsd: number;
    progressToWithdrawPct: number;
  };
  onboarding: {
    linkDone: boolean;
    obsDone: boolean;
  };
};

export type KickLivePartnerDto = {
  partnerTag: string;
  channelSlug: string;
  streamTitle: string | null;
  viewerCount: number | null;
  hasBranding: boolean;
  kickUrl: string;
  betUrl: string;
};

export type KickPartnerWidgetDto = {
  found: boolean;
  partnerTag: string;
  channelSlug: string | null;
  channelAvatarUrl?: string | null;
  channelDisplayName?: string | null;
  isLive: boolean;
  viewerCount: number | null;
  streamTitle: string | null;
  betUrl: string;
  promoCode: string | null;
  widgetUrl: string;
  shortUrlKick: string | null;
  shortUrlImba: string | null;
  liveStats: {
    sessionClicks: number;
    sessionRegistrations: number;
    todayClicks: number;
  } | null;
  viewerOffer: {
    streamerLabel: string;
    promoCode: string | null;
    headline: string;
  } | null;
  streamRace: {
    goal: number;
    current: number;
    bonusUsd: number;
    granted: boolean;
    active: boolean;
  } | null;
  guessContest: {
    active: boolean;
    matchLabel: string | null;
    currentScore: string | null;
    guessCount: number;
    recentGuesses: Array<{
      username: string;
      home: number;
      away: number;
    }>;
  } | null;
};

export type KickLeaderboardItem = {
  rank: number;
  channelSlug: string;
  partnerTag: string;
  kickRegistrations: number;
  kickFtd: number;
  earningsUsd: number;
  isLive: boolean;
  viewerCount: number | null;
};

export type KickSessionLiveStatsDto = {
  active: boolean;
  sessionId: string | null;
  startedAt: string | null;
  clicks: number;
  registrations: number;
  ftd: number;
  commissionUsd: number;
  streamTitle: string | null;
  peakViewers: number;
  streamRace: {
    goal: number;
    current: number;
    bonusUsd: number;
    granted: boolean;
    active: boolean;
  } | null;
  streak: {
    goal: number;
    current: number;
    bonusUsd: number;
  } | null;
  guessContest: {
    active: boolean;
    matchLabel: string | null;
    currentScore: string | null;
    guessCount: number;
    recentGuesses: Array<{
      username: string;
      home: number;
      away: number;
    }>;
  } | null;
};

export type KickTabloStreamItem = {
  partnerTag: string;
  channelSlug: string;
  streamTitle: string | null;
  viewerCount: number | null;
  isLive: boolean;
  hasBranding: boolean;
  kickUrl: string;
  betUrl: string;
  shortUrl: string | null;
};

export type KickPublicScoreboardDto = {
  connectedCount: number;
  liveCount: number;
  todayKickRegistrations: number;
  weekKickRegistrations: number;
  todayClicks: number;
  streams: KickTabloStreamItem[];
  topWeek: KickLeaderboardItem[];
  /** @deprecated используйте streams */
  livePartners: Array<{
    channelSlug: string;
    partnerTag: string;
    streamTitle: string | null;
    viewerCount: number | null;
    kickUrl: string;
  }>;
  leaderboard: KickLeaderboardItem[];
  weeklyChallenge: {
    goal: number;
    bonusUsd: number;
    weekEndsAt: string;
    topProgress: number;
  };
  channelOfWeek: KickLeaderboardItem | null;
  monthPayoutsUsd: number;
  monthSprint: {
    monthKey: string;
    endsAt: string;
    bonusUsd: number;
    minRegs: number;
    leader: {
      channelSlug: string;
      kickRegistrations: number;
    } | null;
  };
  liveCollab: {
    active: boolean;
    count: number;
    hint: string;
    partners: Array<{
      channelSlug: string;
      partnerTag: string;
      kickUrl: string;
    }>;
  } | null;
};

export type KickPartnerAnalyticsDto = {
  periodDays: number;
  currencyCode: string;
  kickTraffic: {
    registrations: number;
    ftd: number;
    commission: number;
    connectBonus: number;
    connectBonusGranted: boolean;
    conversionPct: number;
  };
  duringLive: {
    registrations: number;
    ftd: number;
  };
  sessions30d: {
    count: number;
    compliantHours: number;
    totalPeakViewers: number;
    brandedSessions: number;
  };
  byChannel: Array<{
    channel: string;
    registrations: number;
    ftd: number;
  }>;
};

export type KickPartnerAdminItem = {
  userId: number;
  email: string;
  uid: string;
  affilatorStatus: string;
  connected: boolean;
  channelSlug: string | null;
  channelTitle: string | null;
  connectedAt: string | null;
  isLive: boolean;
  viewerCount: number | null;
  streamTitle: string | null;
  hasBranding: boolean;
  compliantHours30d: number;
  tokenExpiresAt: string | null;
  tokenRefreshFailedAt: string | null;
  sessionsCount: number;
  registrationBonusPaid: number;
  activationCount: number;
  onboardingComplete: boolean;
  lastSessionAt: string | null;
};

export type KickPartnerAdminSessionItem = {
  id: string;
  partnerUserId: number;
  partnerEmail: string;
  partnerTag: string;
  kickChannel: string;
  startedAt: string;
  endedAt: string | null;
  peakViewers: number;
  hadBranding: boolean;
  lastStreamTitle: string | null;
  durationMinutes: number | null;
};
