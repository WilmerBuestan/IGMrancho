import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

/// Entrar al panel con huella: las credenciales quedan cifradas en el celular
/// y solo se leen después de confirmar la huella.
class Biometric {
  static const _storage = FlutterSecureStorage();
  static final _auth = LocalAuthentication();

  static Future<bool> available() async {
    try {
      return await _auth.isDeviceSupported() && await _auth.canCheckBiometrics;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> hasSaved() async => (await _storage.read(key: 'bio_user')) != null;

  static Future<void> save(String user, String password) async {
    await _storage.write(key: 'bio_user', value: user);
    await _storage.write(key: 'bio_pass', value: password);
  }

  static Future<void> forget() async {
    await _storage.delete(key: 'bio_user');
    await _storage.delete(key: 'bio_pass');
  }

  /// Pide la huella y devuelve (usuario, contraseña) si se confirmó.
  static Future<(String, String)?> unlock() async {
    try {
      final ok = await _auth.authenticate(localizedReason: 'Confirma tu huella para entrar a la administración', persistAcrossBackgrounding: true);
      if (!ok) return null;
      final u = await _storage.read(key: 'bio_user');
      final p = await _storage.read(key: 'bio_pass');
      return (u != null && p != null) ? (u, p) : null;
    } catch (_) {
      return null;
    }
  }
}
