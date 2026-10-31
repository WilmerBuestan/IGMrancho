import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/biometric.dart';
import '../../core/push.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

class AdminLoginScreen extends StatefulWidget {
  const AdminLoginScreen({super.key});
  @override
  State<AdminLoginScreen> createState() => _AdminLoginScreenState();
}

class _AdminLoginScreenState extends State<AdminLoginScreen> {
  final user = TextEditingController();
  final pass = TextEditingController();
  bool loading = false, hidden = true, bioAvailable = false, bioSaved = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _initBio();
  }

  Future<void> _initBio() async {
    final a = await Biometric.available();
    final s = await Biometric.hasSaved();
    if (!mounted) return;
    setState(() => (bioAvailable = a, bioSaved = s));
    if (a && s) _bio();
  }

  Future<void> _login(String u, String p, {bool fromBio = false}) async {
    setState(() => (loading = true, error = null));
    try {
      await api.login(u, p);
      push.syncAdmin();
      if (!fromBio && bioAvailable && !bioSaved && mounted) {
        final ok = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            icon: const Icon(Icons.fingerprint_rounded, size: 48),
            title: const Text('¿Entrar con tu huella?'),
            content: const Text('La próxima vez entra al panel solo con tu huella, sin escribir la contraseña.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Ahora no')),
              FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Activar')),
            ],
          ),
        );
        if (ok == true) await Biometric.save(u, p);
      }
      if (mounted) context.go('/admin');
    } on ApiException catch (e) {
      if (fromBio && e.status == 401) await Biometric.forget();
      if (mounted) setState(() => error = fromBio && e.status == 401 ? 'La contraseña cambió. Escríbela de nuevo.' : e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _bio() async {
    final creds = await Biometric.unlock();
    if (creds != null) await _login(creds.$1, creds.$2, fromBio: true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: Brand.heroGradient),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(22),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: AutofillGroup(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      const Center(child: Logos(height: 56)),
                      const SizedBox(height: 14),
                      const Text('IGM Rancho', textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                      Text('Acceso de administración', textAlign: TextAlign.center, style: TextStyle(color: context.muted)),
                      const SizedBox(height: 22),
                      TextField(
                        controller: user,
                        autofillHints: const [AutofillHints.username],
                        decoration: const InputDecoration(labelText: 'Usuario', prefixIcon: Icon(Icons.person_outline)),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: pass,
                        obscureText: hidden,
                        autofillHints: const [AutofillHints.password],
                        onSubmitted: (_) => _login(user.text.trim(), pass.text),
                        decoration: InputDecoration(
                          labelText: 'Contraseña',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(icon: Icon(hidden ? Icons.visibility : Icons.visibility_off), onPressed: () => setState(() => hidden = !hidden)),
                        ),
                      ),
                      if (error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: Text(error!, style: const TextStyle(color: Brand.danger)).animate().shake(hz: 4, duration: 400.ms),
                        ),
                      const SizedBox(height: 18),
                      FilledButton(
                        onPressed: loading ? null : () => _login(user.text.trim(), pass.text),
                        child: loading ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 3)) : const Text('Entrar'),
                      ),
                      if (bioAvailable && bioSaved) ...[
                        const SizedBox(height: 10),
                        OutlinedButton.icon(onPressed: loading ? null : _bio, icon: const Icon(Icons.fingerprint_rounded), label: const Text('Entrar con huella')),
                      ],
                      const SizedBox(height: 6),
                      TextButton(onPressed: () => context.go('/'), child: const Text('← Volver al inicio')),
                    ]),
                  ),
                ),
              ),
            ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.08),
          ),
        ),
      ),
    );
  }
}
