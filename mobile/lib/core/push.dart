import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api.dart';
import 'profile.dart';

/// Notificaciones push (Firebase Cloud Messaging, proyecto igm-rancho-app).
class Push {
  Push._();
  static final instance = Push._();

  String? token;
  void Function(String route)? onOpenRoute;
  final _local = FlutterLocalNotificationsPlugin();
  bool _started = false;

  Future<void> start() async {
    if (_started) return;
    _started = true;
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
      final fcm = FirebaseMessaging.instance;
      final perm = await fcm.requestPermission();
      if (perm.authorizationStatus == AuthorizationStatus.denied) return;
      // ignore: deprecated_member_use
      token = await fcm.getToken();
      // ignore: deprecated_member_use
      fcm.onTokenRefresh.listen((t) {
        token = t;
        syncClient();
        if (api.isAdmin) syncAdmin();
      });
      await _local.initialize(
        settings: const InitializationSettings(android: AndroidInitializationSettings('ic_stat_rancho')),
        onDidReceiveNotificationResponse: (r) {
          if (r.payload?.isNotEmpty ?? false) onOpenRoute?.call(r.payload!);
        },
      );
      // Con la app abierta Android no muestra el aviso: lo mostramos nosotros
      FirebaseMessaging.onMessage.listen(_showLocal);
      FirebaseMessaging.onMessageOpenedApp.listen((m) => _open(m.data['route']));
      final initial = await fcm.getInitialMessage();
      if (initial != null) _open(initial.data['route']);
      await syncClient();
      if (api.isAdmin) await syncAdmin();
    } catch (e) {
      debugPrint('Notificaciones no disponibles: $e');
    }
  }

  void _open(String? route) {
    if (route != null && route.isNotEmpty) onOpenRoute?.call(route);
  }

  Future<void> _showLocal(RemoteMessage m) async {
    final n = m.notification;
    if (n == null) return;
    await _local.show(
      id: (m.messageId ?? '${DateTime.now()}').hashCode,
      title: n.title,
      body: n.body,
      payload: m.data['route'],
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails('igm_rancho', 'IGM Rancho',
            icon: 'ic_stat_rancho', color: Color(0xFF2E3D28), importance: Importance.high, priority: Priority.high),
      ),
    );
  }

  /// Registra este celular con la cédula y el correo de la persona (avisos de su pago y recordatorios).
  Future<void> syncClient() async {
    if (token == null) return;
    try {
      await api.registerDevice(token!,
          cedula: profile.cedula.isEmpty ? null : profile.cedula,
          email: profile.email.isEmpty ? null : profile.email,
          reminders: profile.reminders);
    } catch (e) {
      debugPrint('No se pudo registrar el celular: $e');
    }
  }

  /// El celular del admin recibe un aviso por cada pago nuevo.
  Future<void> syncAdmin() async {
    if (token == null) return;
    try {
      await api.registerAdminDevice(token!);
    } catch (_) {}
  }

  Future<void> stopAdmin() async {
    if (token == null) return;
    try {
      await api.unregisterAdminDevice(token!);
    } catch (_) {}
  }
}

final push = Push.instance;
