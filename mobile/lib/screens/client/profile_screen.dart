import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/profile.dart';
import '../../core/push.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: profile,
      builder: (context, _) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        children: [
          const Text('Mi perfil', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Brand.gold,
                  child: Text(profile.fullName.isEmpty ? '?' : profile.fullName.trim().split(' ').last[0].toUpperCase(),
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Brand.ink)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: profile.complete
                      ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(profile.fullName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
                          Text(profile.cedula, style: TextStyle(color: context.muted)),
                          Text(profile.email, style: TextStyle(color: context.muted, fontSize: 13)),
                        ])
                      : Text('Tus datos se guardan aquí después de tu primera reserva.', style: TextStyle(color: context.muted)),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            child: Column(children: [
              SwitchListTile(
                secondary: const Icon(Icons.alarm_rounded),
                title: const Text('Recordatorio para reservar'),
                subtitle: const Text('Te avisamos antes de la hora límite si aún no reservaste'),
                value: profile.reminders,
                onChanged: (v) async {
                  await profile.setReminders(v);
                  push.syncClient();
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.dark_mode_outlined),
                title: const Text('Modo oscuro'),
                subtitle: const Text('Sigue el tema de tu celular (Ajustes → Pantalla)'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.shield_outlined),
                title: const Text('Política de privacidad'),
                trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                onTap: () => launchUrl(Uri.parse('$webUrl/privacidad'), mode: LaunchMode.externalApplication),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.admin_panel_settings_outlined),
                title: const Text('Administración'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => context.go('/admin'),
              ),
            ]),
          ),
          if (profile.complete) ...[
            const SizedBox(height: 14),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(foregroundColor: Brand.danger),
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Borrar mis datos de este celular'),
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (c) => AlertDialog(
                    title: const Text('¿Borrar tus datos?'),
                    content: const Text('Se borrarán tu nombre, cédula, correo y última reserva de este celular. Tus reservas no se pierden.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancelar')),
                      FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Borrar')),
                    ],
                  ),
                );
                if (ok == true) {
                  await profile.clear();
                  push.syncClient();
                  if (context.mounted) toast(context, 'Datos borrados');
                }
              },
            ),
          ],
        ],
      ),
    );
  }
}
