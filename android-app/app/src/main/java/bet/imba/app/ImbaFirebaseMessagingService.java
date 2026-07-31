package bet.imba.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class ImbaFirebaseMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "imba_alerts";
    public static final String CHANNEL_FINANCE_ID = "imba_finance";
    private static final String HOST = "https://imba.bet";

    private static final int COLOR_ACCENT = Color.parseColor("#F59E0B");
    private static final int COLOR_SUCCESS = Color.parseColor("#22C55E");
    private static final int COLOR_ERROR = Color.parseColor("#EF4444");
    private static final int COLOR_DEFAULT = Color.parseColor("#090F1E");

    @Override
    public void onMessageReceived(RemoteMessage message) {
        ensureChannels(this);

        String title = null;
        String body = "";
        String url = HOST;
        String type = "";
        String tone = "info";

        if (message.getData() != null && !message.getData().isEmpty()) {
            title = message.getData().get("title");
            body = message.getData().get("body");
            type = safe(message.getData().get("type"));
            tone = safe(message.getData().get("tone"));
            if (tone.isEmpty()) {
                tone = "info";
            }
            if (message.getData().containsKey("url")) {
                String path = message.getData().get("url");
                if (path != null && !path.isEmpty()) {
                    url = path.startsWith("http") ? path : HOST + path;
                }
            }
        }

        if (title == null || title.isEmpty()) {
            title = message.getNotification() != null
                    ? message.getNotification().getTitle()
                    : getString(R.string.app_name);
        }
        if (body == null) {
            body = message.getNotification() != null
                    ? message.getNotification().getBody()
                    : "";
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.setData(Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                (int) System.currentTimeMillis(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        boolean isFinance = "deposit".equals(type) || "withdraw".equals(type);
        String channelId = isFinance ? CHANNEL_FINANCE_ID : CHANNEL_ID;
        int color = colorForTone(tone);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(color)
                .setContentTitle(title)
                .setContentText(body)
                .setSubText("IMBA BET")
                .setStyle(new NotificationCompat.BigTextStyle()
                        .setBigContentTitle(title)
                        .bigText(body)
                        .setSummaryText("IMBA BET"))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(isFinance
                        ? NotificationCompat.CATEGORY_STATUS
                        : NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setSound(Settings.System.DEFAULT_NOTIFICATION_URI)
                .setVibrate(new long[]{0, 180, 90, 180})
                .setLights(color, 600, 1200)
                .setContentIntent(pendingIntent);

        if (isFinance) {
            builder.setGroup("imba_finance");
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            int notifyId = (title + "|" + body).hashCode();
            manager.notify(notifyId, builder.build());
        }
    }

    @Override
    public void onNewToken(String token) {
        MainActivity.dispatchFcmToken(this, token);
    }

    private static int colorForTone(String tone) {
        if ("success".equals(tone)) return COLOR_SUCCESS;
        if ("error".equals(tone)) return COLOR_ERROR;
        if ("info".equals(tone)) return COLOR_ACCENT;
        return COLOR_DEFAULT;
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }

        AudioAttributes audio = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    context.getString(R.string.notification_channel_name),
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(context.getString(R.string.notification_channel_desc));
            channel.enableVibration(true);
            channel.enableLights(true);
            channel.setLightColor(COLOR_ACCENT);
            channel.setSound(Settings.System.DEFAULT_NOTIFICATION_URI, audio);
            manager.createNotificationChannel(channel);
        }

        if (manager.getNotificationChannel(CHANNEL_FINANCE_ID) == null) {
            NotificationChannel finance = new NotificationChannel(
                    CHANNEL_FINANCE_ID,
                    context.getString(R.string.notification_channel_finance_name),
                    NotificationManager.IMPORTANCE_HIGH
            );
            finance.setDescription(context.getString(R.string.notification_channel_finance_desc));
            finance.enableVibration(true);
            finance.enableLights(true);
            finance.setLightColor(COLOR_SUCCESS);
            finance.setSound(Settings.System.DEFAULT_NOTIFICATION_URI, audio);
            finance.setShowBadge(true);
            manager.createNotificationChannel(finance);
        }
    }

    private void ensureChannel() {
        ensureChannels(this);
    }
}
