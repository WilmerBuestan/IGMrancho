import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';

class Logos extends StatelessWidget {
  const Logos({super.key, this.height = 44});
  final double height;
  @override
  Widget build(BuildContext context) {
    Widget box(String asset) => Container(
          height: height,
          padding: EdgeInsets.all(height * 0.1),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(height * 0.22)),
          child: Image.asset(asset, fit: BoxFit.contain),
        );
    return Row(mainAxisSize: MainAxisSize.min, children: [
      box('assets/logo-ministerio.png'),
      SizedBox(width: height * 0.2),
      box('assets/logo-igm.png'),
    ]);
  }
}

class BrandTitle extends StatelessWidget {
  const BrandTitle({super.key, this.subtitle});
  final String? subtitle;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text.rich(TextSpan(children: [
            const TextSpan(text: 'IGM '),
            TextSpan(text: 'Rancho', style: TextStyle(color: Brand.gold)),
          ]), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 19, color: Colors.white)),
          if (subtitle != null) Text(subtitle!, style: const TextStyle(fontSize: 12, color: Brand.green300)),
        ],
      );
}

/// Número de paso dorado + título.
class StepTitle extends StatelessWidget {
  const StepTitle(this.n, this.title, {super.key});
  final int n;
  final String title;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
        child: Row(children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: const BoxDecoration(color: Brand.gold, shape: BoxShape.circle),
            child: Text('$n', style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.ink)),
          ),
          const SizedBox(width: 12),
          Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        ]),
      );
}

/// Contador con animación: sube o baja suavemente.
class AnimatedCount extends StatelessWidget {
  const AnimatedCount(this.value, {super.key, this.style, this.money = false});
  final int value;
  final TextStyle? style;
  final bool money;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(end: value.toDouble()),
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeOutCubic,
        builder: (_, v, _) => Text(money ? moneyFmt(v.round()) : '${v.round()}',
            style: (style ?? const TextStyle()).copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
      );
}

String moneyFmt(int cents) => money(cents);

/// − 0 + con vibración y rebote del número.
class QtyStepper extends StatelessWidget {
  const QtyStepper({super.key, required this.value, required this.onChanged, this.max = 20});
  final int value;
  final int max;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) {
    Widget btn(IconData icon, bool enabled, VoidCallback onTap, {bool primary = false}) => AnimatedOpacity(
          duration: const Duration(milliseconds: 200),
          opacity: enabled ? 1 : 0.35,
          child: Material(
            color: primary ? context.colors.primary : context.subtle,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: enabled
                  ? () {
                      HapticFeedback.selectionClick();
                      onTap();
                    }
                  : null,
              child: SizedBox(width: 44, height: 44, child: Icon(icon, color: primary ? context.colors.onPrimary : context.colors.primary)),
            ),
          ),
        );
    return Row(mainAxisSize: MainAxisSize.min, children: [
      btn(Icons.remove_rounded, value > 0, () => onChanged(value - 1)),
      SizedBox(
        width: 40,
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          transitionBuilder: (c, a) => ScaleTransition(scale: a, child: c),
          child: Text('$value', key: ValueKey(value), textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        ),
      ),
      btn(Icons.add_rounded, value < max, () => onChanged(value + 1), primary: true),
    ]);
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.status, {super.key});
  final Status status;
  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = switch (status) {
      Status.pendiente => (const Color(0x55F3D27A), const Color(0xFF9A6B0F), Icons.schedule_rounded),
      Status.aprobada => (context.isDark ? Brand.green700 : Brand.green100, context.isDark ? Brand.green100 : Brand.green700, Icons.check_circle_rounded),
      Status.rechazada => (const Color(0x22C62828), Brand.danger, Icons.cancel_rounded),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: fg),
        const SizedBox(width: 4),
        Text(status.label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
      ]),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView(this.message, {super.key, this.onRetry});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('📡', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: TextStyle(color: context.muted)),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              FilledButton.tonal(onPressed: onRetry, child: const Text('Reintentar')),
            ],
          ]),
        ),
      );
}

/// Bloques grises que "respiran" mientras carga.
class LoadingList extends StatelessWidget {
  const LoadingList({super.key, this.count = 4, this.height = 90});
  final int count;
  final double height;
  @override
  Widget build(BuildContext context) => ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: count,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (_, i) => Container(
          height: height,
          decoration: BoxDecoration(color: context.isDark ? Colors.white10 : Colors.white, borderRadius: BorderRadius.circular(20)),
        ).animate(onPlay: (c) => c.repeat()).shimmer(duration: 1200.ms, color: context.isDark ? Colors.white10 : Brand.green50),
      );
}

class Tile extends StatelessWidget {
  const Tile({super.key, required this.label, required this.child, this.sub, this.highlight = false, this.onTap, this.dot});
  final String label;
  final Widget child;
  final String? sub;
  final bool highlight;
  final VoidCallback? onTap;
  final Color? dot;
  @override
  Widget build(BuildContext context) => Card(
        shape: highlight
            ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: const BorderSide(color: Brand.gold, width: 2))
            : null,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                if (dot != null) ...[
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: dot, borderRadius: BorderRadius.circular(3))),
                  const SizedBox(width: 6),
                ],
                Flexible(child: Text(label.toUpperCase(),
                    style: TextStyle(fontSize: 11, letterSpacing: 0.6, fontWeight: FontWeight.w700, color: context.muted))),
              ]),
              const SizedBox(height: 6),
              DefaultTextStyle.merge(style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800), child: child),
              if (sub != null) Text(sub!, style: TextStyle(fontSize: 13, color: context.muted)),
            ]),
          ),
        ),
      );
}

void toast(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Brand.danger : null,
    ));
}
