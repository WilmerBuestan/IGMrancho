import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/biometric.dart';
import '../../core/config.dart';
import '../../core/push.dart';
import '../../core/theme.dart';

class AdminMoreScreen extends StatefulWidget {
  const AdminMoreScreen({super.key});
  @override
  State<AdminMoreScreen> createState() => _AdminMoreScreenState();
}

class _AdminMoreScreenState extends State<AdminMoreScreen> {
  bool bio = false, bioAvailable = false;

  @override
  void initState() {
    super.initState();
    Future.wait([Biometric.available(), Biometric.hasSaved()]).then((r) {
      if (mounted) setState(() => (bioAvailable = r[0], bio = r[1]));
    });
  }

  @override
  Widget build(BuildContext context) {
    Widget item(IconData icon, String title, String sub, String route) => Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            leading: CircleAvatar(backgroundColor: context.subtle, child: Icon(icon, color: context.colors.primary)),
            title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(sub),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.go(route),
          ),
        );
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        const Text('Ajustes', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
        const SizedBox(height: 14),
        item(Icons.attach_money_rounded, 'Precios y menú', 'Precio de cada rancho y aviso del día', '/admin/mas/precios'),
        item(Icons.event_rounded, 'Fechas y horarios', 'Hora límite, recordatorio y días sin servicio', '/admin/mas/horarios'),
        item(Icons.account_balance_rounded, 'Cuenta, QR y Drive', 'Datos para transferir y respaldo de capturas', '/admin/mas/cuenta'),
        const SizedBox(height: 8),
        Card(
          child: Column(children: [
            if (bioAvailable)
              SwitchListTile(
                secondary: const Icon(Icons.fingerprint_rounded),
                title: const Text('Entrar con huella'),
                subtitle: Text(bio ? 'Activado en este celular' : 'Se activa al iniciar sesión con contraseña'),
                value: bio,
                onChanged: bio
                    ? (_) async {
                        await Biometric.forget();
                        setState(() => bio = false);
                      }
                    : null,
              ),
            ListTile(
              leading: const Icon(Icons.public_rounded),
              title: const Text('Abrir la versión web'),
              trailing: const Icon(Icons.open_in_new_rounded, size: 18),
              onTap: () => launchUrl(Uri.parse('$webUrl/admin'), mode: LaunchMode.externalApplication),
            ),
            ListTile(
              leading: const Icon(Icons.logout_rounded, color: Brand.danger),
              title: const Text('Cerrar sesión', style: TextStyle(color: Brand.danger)),
              subtitle: const Text('Este celular deja de recibir avisos de pagos'),
              onTap: () async {
                await push.stopAdmin();
                await api.logout();
                if (context.mounted) context.go('/');
              },
            ),
          ]),
        ),
      ],
    );
  }
}
