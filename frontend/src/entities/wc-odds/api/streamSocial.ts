import { getSessionClient } from "~/entities/user/lib/getSessionClient";

const API = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

export type StreamSocialComment = {
  id: number;
  body: string;
  createdAt: string;
  user: {
    id: number;
    nickname: string | null;
    name: string;
  };
};

export type StreamSocialSnapshot = {
  streamKey: string;
  likeCount: number;
  likedByMe: boolean;
  canComment: boolean;
  canCommentReason: "need_login" | "need_bet" | null;
  comments: StreamSocialComment[];
};

async function authFetch(path: string, init?: RequestInit) {
  const token = getSessionClient();
  const res = await fetch(`${API()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message || body?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchStreamSocial(
  streamKey: string,
): Promise<StreamSocialSnapshot> {
  const token = getSessionClient();
  const res = await fetch(
    `${API()}/api/casino/streams/${encodeURIComponent(streamKey)}/social`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
      credentials: "include",
    },
  );
  if (!res.ok) {
    return {
      streamKey,
      likeCount: 0,
      likedByMe: false,
      canComment: false,
      canCommentReason: token ? "need_bet" : "need_login",
      comments: [],
    };
  }
  const data = await res.json();
  return {
    streamKey: data.streamKey || streamKey,
    likeCount: Number(data.likeCount) || 0,
    likedByMe: Boolean(data.likedByMe),
    canComment: Boolean(data.canComment),
    canCommentReason:
      data.canCommentReason === "need_bet" ||
      data.canCommentReason === "need_login"
        ? data.canCommentReason
        : data.canComment
          ? null
          : token
            ? "need_bet"
            : "need_login",
    comments: Array.isArray(data.comments) ? data.comments : [],
  };
}

export function streamSocialLiveUrl(streamKey: string) {
  return `${API()}/api/casino/streams/${encodeURIComponent(streamKey)}/live`;
}

export function toggleStreamLike(streamKey: string) {
  return authFetch(
    `/api/casino/streams/${encodeURIComponent(streamKey)}/like`,
    { method: "POST" },
  ) as Promise<{ streamKey: string; liked: boolean; likeCount: number }>;
}

export function postStreamComment(streamKey: string, body: string) {
  return authFetch(
    `/api/casino/streams/${encodeURIComponent(streamKey)}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  ) as Promise<StreamSocialComment>;
}

export function reportStreamComment(commentId: number, reason?: string) {
  return authFetch(`/api/casino/streams/comments/${commentId}/report`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  }) as Promise<{ ok: boolean; commentId: number; hiddenForMe: boolean }>;
}
