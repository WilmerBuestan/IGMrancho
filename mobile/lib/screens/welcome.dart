import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});
  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> with SingleTickerProviderStateMixin {
  PublicConfig? cfg;
  late final AnimationController glow = AnimationController(vsync: this, duration: const Duration(seconds: 6))..repeat(reverse: true);

  @override
  void initState() {
    super.initState();
    api.config().then((c) => mounted ? setState(() => cfg = c) : null).catchError((_) {});
  }

  @override
  void dispose() {
    glow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(children: [
        Container(decoration: const BoxDecoration(gradient: Brand.heroGradient)),
        // Brillo dorado que se mueve despacio
        AnimatedBuilder(
          animation: glow,
          builder: (_, _) => Positioned(
            right: -120 + 60 * glow.value,
            top: -100 + 40 * glow.value,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: [
                BoxShadow(color: Brand.gold.withValues(alpha: 0.18), blurRadius: 140, spreadRadius: 40),
              ]),
            ),
          ),
        ),
        SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(22, 32, 22, 24),
            children: [
              const Center(child: Logos(height: 84))
                  .animate()
                  .fadeIn(duration: 600.ms)
                  .scale(begin: const Offset(0.8, 0.8), curve: Curves.easeOutBack, duration: 700.ms),
              const SizedBox(height: 28),
              Text(greeting().toUpperCase(), textAlign: TextAlign.center,
                      style: const TextStyle(color: Brand.gold, letterSpacing: 4, fontWeight: FontWeight.w700, fontSize: 13))
                  .animate()
                  .fadeIn(delay: 250.ms),
              const SizedBox(height: 10),
              Text.rich(
                const TextSpan(children: [
                  TextSpan(text: 'Bienvenido a\n'),
                  TextSpan(text: 'IGM Rancho', style: TextStyle(color: Brand.gold)),
                ]),
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 38, height: 1.1, fontWeight: FontWeight.w800),
              ).animate().fadeIn(delay: 350.ms).slideY(begin: 0.25, curve: Curves.easeOutCubic),
              const SizedBox(height: 12),
              const Text(
                'Reserva tu desayuno, almuerzo o merienda del Instituto Geográfico Militar sin filas.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Brand.green100, fontSize: 15.5, height: 1.4),
              ).animate().fadeIn(delay: 500.ms),
              const SizedBox(height: 18),
              if (cfg != null) Center(child: _StatusPill(cfg!)).animate().fadeIn().slideY(begin: 0.3),
              const SizedBox(height: 28),
              _EntryCard(
                emoji: '🍽️',
                title: 'Reservar mi rancho',
                text: 'Elige tus ranchos, paga con el QR y sube tu comprobante.',
                action: 'Entrar como cliente',
                light: true,
                onTap: () => context.go('/reservar'),
              ).animate().fadeIn(delay: 650.ms).slideY(begin: 0.2, curve: Curves.easeOutCubic),
              const SizedBox(height: 14),
              _EntryCard(
                emoji: '🛡️',
                title: 'Administración',
                text: 'Verifica pagos, revisa estadísticas y configura el servicio.',
                action: 'Entrar como administrador',
                onTap: () => context.go(api.isAdmin ? '/admin' : '/admin/login'),
              ).animate().fadeIn(delay: 780.ms).slideY(begin: 0.2, curve: Curves.easeOutCubic),
              const SizedBox(height: 18),
              TextButton(
                onPressed: () => context.go('/mis-reservas'),
                child: const Text('¿Ya reservaste? Consulta tus reservas', style: TextStyle(color: Brand.green300)),
              ),
              const SizedBox(height: 8),
              const Text('Instituto Geográfico Militar · Ministerio de Defensa Nacional',
                  textAlign: TextAlign.center, style: TextStyle(color: Brand.green500, fontSize: 11)),
            ],
          ),
        ),
      ]),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill(this.cfg);
  final PublicConfig cfg;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white24),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: cfg.open ? Colors.greenAccent : Colors.redAccent))
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .fade(begin: 0.4, duration: 900.ms),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              cfg.open ? 'Reservas abiertas para el ${longDate(cfg.serviceDate).toLowerCase()} hasta las ${cfg.cutoff}' : 'Reservas cerradas por el momento',
              style: const TextStyle(color: Colors.white, fontSize: 13),
            ),
          ),
        ]),
      );
}

class _EntryCard extends StatelessWidget {
  const _EntryCard({required this.emoji, required this.title, required this.text, required this.action, required this.onTap, this.light = false});
  final String emoji, title, text, action;
  final VoidCallback onTap;
  final bool light;
  @override
  Widget build(BuildContext context) {
    final fg = light ? Brand.ink : Colors.white;
    return Material(
      color: light ? Colors.white : Colors.white.withValues(alpha: 0.07),
      borderRadius: BorderRadius.circular(26),
      child: InkWell(
        borderRadius: BorderRadius.circular(26),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(22),
          decoration: light ? null : BoxDecoration(borderRadius: BorderRadius.circular(26), border: Border.all(color: Colors.white24)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 52,
              height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: light ? Brand.gold : Colors.white12, borderRadius: BorderRadius.circular(16)),
              child: Text(emoji, style: const TextStyle(fontSize: 26)),
            ),
            const SizedBox(height: 14),
            Text(title, style: TextStyle(color: fg, fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(text, style: TextStyle(color: light ? Brand.green600 : Brand.green100, height: 1.35)),
            const SizedBox(height: 14),
            Row(children: [
              Text(action, style: TextStyle(color: light ? Brand.green800 : Brand.gold, fontWeight: FontWeight.w700)),
              const SizedBox(width: 6),
              Icon(Icons.arrow_forward_rounded, size: 18, color: light ? Brand.green800 : Brand.gold),
            ]),
          ]),
        ),
      ),
    );
  }
}
