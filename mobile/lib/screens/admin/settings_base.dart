import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../widgets/common.dart';

/// Base para las pantallas de ajustes: carga, guarda una parte y muestra el resultado.
abstract class SettingsPageState<T extends StatefulWidget> extends State<T> {
  AdminSettings? settings;
  String? error;
  bool saving = false;

  void apply(AdminSettings s);

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final s = await api.settings();
      if (!mounted) return;
      setState(() => (settings = s, error = null));
      apply(s);
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  Future<void> save(Map<String, dynamic> patch) async {
    setState(() => saving = true);
    try {
      final s = await api.saveSettings(patch);
      if (!mounted) return;
      setState(() => settings = s);
      apply(s);
      toast(context, '✓ Cambios guardados');
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Widget page(String title, List<Widget> children, {VoidCallback? onSave}) {
    Widget body;
    if (error != null && settings == null) {
      body = ErrorView(error!, onRetry: load);
    } else if (settings == null) {
      body = const LoadingList(count: 3);
    } else {
      body = ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 100), children: children);
    }
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: body,
      floatingActionButton: onSave == null || settings == null
          ? null
          : FloatingActionButton.extended(
              onPressed: saving ? null : onSave,
              icon: saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.save_rounded),
              label: const Text('Guardar'),
            ),
    );
  }
}
