import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';
import 'core/api.dart';
import 'core/profile.dart';
import 'core/push.dart';
import 'core/share_inbox.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es');
  await Future.wait([profile.load(), api.loadSession()]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent));
  runApp(const RanchoApp());
  // Después del primer cuadro: no retrasan la apertura de la app
  push.onOpenRoute = (r) => router.go(r);
  shareInbox.onReceived = () => router.go('/reservar');
  push.start();
  shareInbox.start();
}
