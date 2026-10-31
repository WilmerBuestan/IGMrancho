import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';

import 'core/api.dart';
import 'core/theme.dart';
import 'screens/admin/account.dart';
import 'screens/admin/admin_shell.dart';
import 'screens/admin/dashboard.dart';
import 'screens/admin/login.dart';
import 'screens/admin/more.dart';
import 'screens/admin/prices.dart';
import 'screens/admin/reports.dart';
import 'screens/admin/reservations.dart';
import 'screens/admin/schedule.dart';
import 'screens/client/client_shell.dart';
import 'screens/client/lookup.dart';
import 'screens/client/profile_screen.dart';
import 'screens/client/reserve.dart';
import 'screens/welcome.dart';

final router = GoRouter(
  initialLocation: '/',
  refreshListenable: api.sessionExpired,
  redirect: (context, state) {
    final loc = state.matchedLocation;
    if (loc.startsWith('/admin') && loc != '/admin/login' && !api.isAdmin) return '/admin/login';
    return null;
  },
  routes: [
    GoRoute(path: '/', pageBuilder: (_, s) => _fade(s, const WelcomeScreen())),
    StatefulShellRoute.indexedStack(
      builder: (_, _, shell) => ClientShell(shell: shell),
      branches: [
        StatefulShellBranch(routes: [GoRoute(path: '/reservar', builder: (_, _) => const ReserveScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: '/mis-reservas', builder: (_, _) => const LookupScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: '/perfil', builder: (_, _) => const ProfileScreen())]),
      ],
    ),
    GoRoute(path: '/admin/login', pageBuilder: (_, s) => _fade(s, const AdminLoginScreen())),
    StatefulShellRoute.indexedStack(
      builder: (_, _, shell) => AdminShell(shell: shell),
      branches: [
        StatefulShellBranch(routes: [GoRoute(path: '/admin', builder: (_, _) => const DashboardScreen())]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/admin/reservas', builder: (_, s) => ReservationsScreen(date: s.uri.queryParameters['date'], status: s.uri.queryParameters['estado'])),
        ]),
        StatefulShellBranch(routes: [GoRoute(path: '/admin/reportes', builder: (_, _) => const ReportsScreen())]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/admin/mas', builder: (_, _) => const AdminMoreScreen(), routes: [
            GoRoute(path: 'precios', builder: (_, _) => const PricesScreen()),
            GoRoute(path: 'horarios', builder: (_, _) => const ScheduleScreen()),
            GoRoute(path: 'cuenta', builder: (_, _) => const AccountScreen()),
          ]),
        ]),
      ],
    ),
  ],
);

CustomTransitionPage<void> _fade(GoRouterState s, Widget child) => CustomTransitionPage(
      key: s.pageKey,
      child: child,
      transitionDuration: const Duration(milliseconds: 450),
      transitionsBuilder: (_, a, _, c) => FadeTransition(opacity: CurvedAnimation(parent: a, curve: Curves.easeOut), child: c),
    );

class RanchoApp extends StatelessWidget {
  const RanchoApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp.router(
        title: 'IGM Rancho',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: ThemeMode.system,
        routerConfig: router,
        locale: const Locale('es', 'EC'),
        supportedLocales: const [Locale('es', 'EC'), Locale('es')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
      );
}
