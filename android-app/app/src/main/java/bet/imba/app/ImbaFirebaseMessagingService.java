package bet.imba.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class ImbaFirebaseMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "imba_alerts";
  private static final String HOST = "https://imba.bet";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        ensureChannel();

        String title = message.getNotification() != null
                ? message.getNotification().getTitle()
                : getString(R.string.app_name);
        String body = message.getNotification() != null
                ? message.getNotification().getBody()
                : "";

        String url = HOST;
        if (message.getData() != null && message.getData().containsKey("url")) {
            String path = message.getData().get("url");
            if (path != null && !path.isEmpty()) {
                url = path.startsWith("http") ? path : HOST + path;
            }
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

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(getColor(R.color.imba_notification))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify((int) System.currentTimeMillis(), builder.build());
        }
    }

    @Override
    public void onNewToken(String token) {
        MainActivity.dispatchFcmToken(this, token);
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(context.getString(R.string.notification_channel_desc));
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    private void ensureChannel() {
        ensureChannel(this);
    }
}
