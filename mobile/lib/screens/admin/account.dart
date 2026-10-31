import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'settings_base.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends SettingsPageState<AccountScreen> {
  final fields = {
    'titular': ('Titular', TextEditingController()),
    'cedula': ('Cédula del titular', TextEditingController()),
    'banco': ('Banco', TextEditingController()),
    'tipo': ('Tipo de cuenta', TextEditingController()),
    'numero': ('Número de cuenta', TextEditingController()),
  };
  int qrVersion = DateTime.now().millisecondsSinceEpoch;

  @override
  void apply(AdminSettings s) {
    final j = s.account.toJson();
    for (final e in fields.entries) {
      e.value.$2.text = j[e.key] ?? '';
    }
  }

  Future<void> _uploadQr() async {
    final x = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (x == null) return;
    try {
      await api.uploadQr(File(x.path));
      setState(() => qrVersion = DateTime.now().millisecondsSinceEpoch);
      await load();
      if (mounted) toast(context, '✓ QR actualizado');
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = settings;
    return page(
      'Cuenta, QR y Drive',
      [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              for (final e in fields.entries)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: TextField(
                    controller: e.value.$2,
                    keyboardType: e.key == 'numero' || e.key == 'cedula' ? TextInputType.number : TextInputType.text,
                    decoration: InputDecoration(labelText: e.value.$1),
                  ),
                ),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              const Align(alignment: Alignment.centerLeft, child: Text('Código QR', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
              const SizedBox(height: 10),
              if (s?.qrFile != null)
                Container(
                  height: 240,
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                  child: Image.network(api.url('/api/qr?v=$qrVersion'), fit: BoxFit.contain),
                ),
              const SizedBox(height: 10),
              OutlinedButton.icon(onPressed: _uploadQr, icon: const Icon(Icons.qr_code_2_rounded), label: Text(s?.qrFile == null ? 'Subir QR' : 'Cambiar QR')),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Google Drive', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 4),
              Text(
                s?.driveEnabled == true
                    ? '✅ Conectado. Las capturas se suben a la carpeta "IGM Rancho", una subcarpeta por fecha.'
                    : '⚠️ No configurado: las capturas quedan solo en el servidor.',
                style: TextStyle(color: context.muted),
              ),
              if (s?.driveEnabled == true) ...[
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  if (s?.driveFolderUrl != null)
                    FilledButton.tonalIcon(
                      onPressed: () => launchUrl(Uri.parse(s!.driveFolderUrl!), mode: LaunchMode.externalApplication),
                      icon: const Icon(Icons.folder_open_rounded),
                      label: const Text('Abrir carpeta'),
                    ),
                  OutlinedButton(
                    onPressed: () async {
                      await api.retryDrive();
                      if (context.mounted) toast(context, 'Reintentando subidas');
                    },
                    child: const Text('Reintentar fallidas'),
                  ),
                ]),
              ],
              const Divider(height: 28),
              const Text('Notificaciones', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 4),
              Text(s?.pushEnabled == true ? '✅ Activas' : '⚠️ El servidor aún no tiene la llave de Firebase.', style: TextStyle(color: context.muted)),
            ]),
          ),
        ),
      ],
      onSave: () => save({'account': {for (final e in fields.entries) e.key: e.value.$2.text.trim()}}),
    );
  }
}
