import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../widgets/common.dart';

/// Contador de pagos por verificar, compartido por el menú.
final pendingCount = ValueNotifier<int>(0);

Future<void> refreshPending() async {
  try {
    pendingCount.value = (await api.stats()).pendingCount;
  } catch (_) {}
}

class AdminShell extends StatefulWidget {
  const AdminShell({super.key, required this.shell});
  final StatefulNavigationShell shell;
  @override
  State<AdminShell> createState() => _AdminShellState();
}

class _AdminShellState extends State<AdminShell> {
  Timer? timer;

  @override
  void initState() {
    super.initState();
    refreshPending();
    timer = Timer.periodic(const Duration(minutes: 1), (_) => refreshPending());
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.shell;
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 64,
        titleSpacing: 12,
        leading: IconButton(icon: const Icon(Icons.home_rounded), tooltip: 'Inicio', onPressed: () => context.go('/')),
        title: const Row(children: [Logos(height: 34), SizedBox(width: 10), BrandTitle(subtitle: 'Administración')]),
      ),
      body: s,
      bottomNavigationBar: ValueListenableBuilder<int>(
        valueListenable: pendingCount,
        builder: (_, n, _) => NavigationBar(
          selectedIndex: s.currentIndex,
          onDestinationSelected: (i) => s.goBranch(i, initialLocation: i == s.currentIndex),
          destinations: [
            const NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Dashboard'),
            NavigationDestination(
              icon: Badge(isLabelVisible: n > 0, label: Text('$n'), child: const Icon(Icons.fact_check_outlined)),
              selectedIcon: Badge(isLabelVisible: n > 0, label: Text('$n'), child: const Icon(Icons.fact_check)),
              label: 'Registrados',
            ),
            const NavigationDestination(icon: Icon(Icons.bar_chart_outlined), selectedIcon: Icon(Icons.bar_chart), label: 'Reportes'),
            const NavigationDestination(icon: Icon(Icons.tune_outlined), selectedIcon: Icon(Icons.tune), label: 'Ajustes'),
          ],
        ),
      ),
    );
  }
}
