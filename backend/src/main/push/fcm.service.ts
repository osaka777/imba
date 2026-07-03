import { Injectable, Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';

type FcmPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
};

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private auth: GoogleAuth | null = null;
  private projectId: string | null = null;

  private ensureAuth(): boolean {
    if (this.auth) return true;

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      return false;
    }

    try {
      const credentials = JSON.parse(raw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
        this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields');
        return false;
      }

      this.projectId = credentials.project_id;
      this.auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      });
      return true;
    } catch (error) {
      this.logger.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON', error);
      return false;
    }
  }

  async sendToToken(token: string, payload: FcmPayload): Promise<boolean> {
    if (!this.ensureAuth() || !this.projectId || !this.auth) {
      return false;
    }

    try {
      const client = await this.auth.getClient();
      const accessToken = await client.getAccessToken();
      if (!accessToken.token) {
        return false;
      }

      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title: payload.title,
                body: payload.body,
                ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
              },
              data: payload.data ?? {},
              android: {
                priority: 'HIGH',
                notification: {
                  channel_id: 'imba_alerts',
                  color: '#090F1E',
                  icon: 'ic_notification',
                  click_action: 'OPEN_URL',
                },
              },
            },
          }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`FCM send failed (${response.status}): ${text}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn('FCM send error', error);
      return false;
    }
  }
}
