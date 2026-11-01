import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'config.dart';
import 'meals.dart';
import 'models.dart';

class ApiException implements Exception {
  ApiException(this.message, [this.status]);
  final String message;
  final int? status;
  @override
  String toString() => message;
}

/// Cliente HTTP de la API de IGM Rancho (misma API que usa la web).
class Api {
  Api._() {
    _dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      if (o.path.startsWith('/admin') && _token != null) o.headers['Authorization'] = 'Bearer $_token';
      h.next(o);
    }));
  }
  static final instance = Api._();

  final _dio = Dio(BaseOptions(
    baseUrl: '$apiUrl/api',
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
  ));
  static const _storage = FlutterSecureStorage();
  String? _token;

  /// Avisa a la app cuando la sesión de admin expira.
  final sessionExpired = ValueNotifier<int>(0);

  String url(String path) => path.startsWith('http') ? path : '$apiUrl$path';

  Future<T> _call<T>(Future<Response> Function() req, T Function(dynamic) parse) async {
    try {
      final r = await req();
      return parse(r.data);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      final data = e.response?.data;
      if (status == 401 && e.requestOptions.path.startsWith('/admin') && !e.requestOptions.path.endsWith('/login')) {
        await logout();
        sessionExpired.value++;
      }
      final msg = data is Map && data['error'] is String
          ? data['error'] as String
          : (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout
              ? 'Sin conexión con el servidor. Revisa tu internet.'
              : 'Algo salió mal, intenta de nuevo.');
      throw ApiException(msg, status);
    }
  }

  // ---------- Público ----------
  Future<PublicConfig> config() => _call(() => _dio.get('/config'), (d) => PublicConfig.fromJson(d));

  Future<Map<String, dynamic>> reserve({
    required String fullName,
    required String cedula,
    required String email,
    required Qty qty,
    required File file,
    required String mime,
  }) {
    final form = FormData.fromMap({
      'fullName': fullName,
      'cedula': cedula,
      'email': email,
      for (final m in Meal.values) m.name: '${qty[m]}',
      'comprobante': MultipartFile.fromFileSync(file.path,
          filename: file.uri.pathSegments.last, contentType: DioMediaType.parse(mime)),
    });
    return _call(() => _dio.post('/reservations', data: form), (d) => Map<String, dynamic>.from(d));
  }

  Future<List<Reservation>> lookup(String cedula, String email) => _call(
        () => _dio.get('/reservations/lookup', queryParameters: {'cedula': cedula, 'email': email}),
        (d) => (d as List).map((e) => Reservation.fromJson(e)).toList(),
      );

  Future<void> registerDevice(String token, {String? cedula, String? email, bool reminders = true}) => _call(
        () => _dio.post('/devices', data: {'token': token, 'cedula': cedula, 'email': email, 'reminders': reminders}),
        (_) {},
      );

  // ---------- Administración ----------
  bool get isAdmin => _token != null;

  Future<void> loadSession() async => _token = await _storage.read(key: 'admin_token');

  Future<void> login(String user, String password) async {
    final t = await _call(() => _dio.post('/admin/login', data: {'user': user, 'password': password}), (d) => d['token'] as String);
    _token = t;
    await _storage.write(key: 'admin_token', value: t);
  }

  Future<void> logout() async {
    _token = null;
    await _storage.delete(key: 'admin_token');
  }

  Future<Stats> stats() => _call(() => _dio.get('/admin/stats'), (d) => Stats.fromJson(d));

  Future<DayList> dayList(String? date, {String q = ''}) => _call(
        () => _dio.get('/admin/reservations', queryParameters: {if (date != null) 'date': date, if (q.isNotEmpty) 'q': q}),
        (d) => DayList.fromJson(d),
      );

  Future<void> setStatus(String id, Status status, String note) => _call(
        () => _dio.patch('/admin/reservations/$id', data: {'status': status.name, 'adminNote': note}),
        (_) {},
      );

  Future<Report> report(String from, String to) =>
      _call(() => _dio.get('/admin/report', queryParameters: {'from': from, 'to': to}), (d) => Report.fromJson(d));

  Future<String> exportCsv(String query) =>
      _call(() => _dio.get('/admin/export.csv?$query', options: Options(responseType: ResponseType.plain)), (d) => d as String);

  Future<AdminSettings> settings() => _call(() => _dio.get('/admin/settings'), (d) => AdminSettings.fromJson(d));

  Future<AdminSettings> saveSettings(Map<String, dynamic> patch) =>
      _call(() => _dio.put('/admin/settings', data: patch), (d) => AdminSettings.fromJson(d));

  Future<void> uploadQr(File f) => _call(
        () => _dio.post('/admin/qr', data: FormData.fromMap({'qr': MultipartFile.fromFileSync(f.path, contentType: DioMediaType.parse('image/jpeg'))})),
        (_) {},
      );

  Future<void> retryDrive() => _call(() => _dio.post('/admin/drive/retry'), (_) {});

  /// Crear (id == null) o editar una reserva desde el panel. [file] reemplaza el comprobante.
  Future<Reservation> saveReservation({
    String? id,
    required Map<String, dynamic> fields,
    File? file,
    String? mime,
  }) {
    final form = FormData.fromMap({
      for (final e in fields.entries) e.key: '${e.value ?? ''}',
      if (file != null)
        'comprobante': MultipartFile.fromFileSync(file.path,
            filename: file.uri.pathSegments.last, contentType: DioMediaType.parse(mime ?? 'image/jpeg')),
    });
    return _call(
      () => id == null ? _dio.post('/admin/reservations', data: form) : _dio.put('/admin/reservations/$id', data: form),
      (d) => Reservation.fromJson(d),
    );
  }

  Future<void> deleteReservation(String id, String reason) =>
      _call(() => _dio.delete('/admin/reservations/$id', data: {'reason': reason}), (_) {});

  Future<List<HistoryItem>> history(String id) => _call(
        () => _dio.get('/admin/reservations/$id/history'),
        (d) => (d as List).map((e) => HistoryItem.fromJson(e)).toList(),
      );

  Future<void> registerAdminDevice(String token) => _call(() => _dio.post('/admin/devices', data: {'token': token}), (_) {});

  Future<void> unregisterAdminDevice(String token) => _call(() => _dio.delete('/admin/devices/$token'), (_) {});
}

final api = Api.instance;
