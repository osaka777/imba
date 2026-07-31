import { Injectable } from '@nestjs/common';
import { Observable, Subject, interval, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export type StreamSocialLiveEvent =
  | { type: 'comment'; comment: unknown }
  | { type: 'like'; likeCount: number; liked?: boolean }
  | { type: 'hide'; commentId: number }
  | { type: 'ping' };

type SsePayload = { data: StreamSocialLiveEvent };

@Injectable()
export class StreamSocialHub {
  private readonly bus = new Subject<{
    streamKey: string;
    event: StreamSocialLiveEvent;
  }>();

  publish(streamKey: string, event: StreamSocialLiveEvent) {
    this.bus.next({ streamKey, event });
  }

  subscribe(streamKey: string): Observable<SsePayload> {
    const key = decodeURIComponent(String(streamKey || '')).trim();
    return new Observable((subscriber) => {
      const sub = merge(
        this.bus.pipe(
          filter((msg) => msg.streamKey === key),
          map((msg) => ({ data: msg.event })),
        ),
        interval(15_000).pipe(map(() => ({ data: { type: 'ping' as const } }))),
      ).subscribe(subscriber);
      return () => sub.unsubscribe();
    });
  }
}
