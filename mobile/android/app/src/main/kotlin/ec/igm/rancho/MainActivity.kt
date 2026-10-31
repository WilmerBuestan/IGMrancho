package ec.igm.rancho

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterFragmentActivity

// FragmentActivity: requerido por local_auth para mostrar el diálogo de huella
class MainActivity : FlutterFragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel("igm_rancho", "IGM Rancho", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Pagos aprobados, pagos nuevos y recordatorios de reserva"
                    enableVibration(true)
                }
            )
        }
    }
}
