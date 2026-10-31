import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../widgets/common.dart';

class ClientShell extends StatelessWidget {
  const ClientShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 64,
        titleSpacing: 12,
        leading: IconButton(icon: const Icon(Icons.home_rounded), tooltip: 'Inicio', onPressed: () => context.go('/')),
        title: const Row(children: [Logos(height: 36), SizedBox(width: 10), BrandTitle(subtitle: 'Reserva de alimentación')]),
      ),
      body: shell,
      bottomNavigationBar: NavWithFirma(nav: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.restaurant_outlined), selectedIcon: Icon(Icons.restaurant), label: 'Reservar'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Mis reservas'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Mi perfil'),
        ],
      )),
    );
  }
}
