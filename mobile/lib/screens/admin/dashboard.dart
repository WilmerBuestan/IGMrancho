import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/meals.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../../widgets/stacked_bars.dart';
import 'admin_shell.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Stats? s;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await api.stats();
      pendingCount.value = r.pendingCount;
      if (mounted) setState(() => (s = r, error = null));
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null && s == null) return ErrorView(error!, onRetry: _load);
    final st = s;
    if (st == null) return const LoadingList(count: 4, height: 120);
    final tomorrow = st.daily.where((d) => d.date == st.tomorrow).firstOrNull;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
        children: [
          Text('${greeting()}, Erick', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
          Text(longDate(st.today), style: TextStyle(color: context.muted)),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            ActionChip(
              avatar: Icon(Icons.circle, size: 10, color: st.open ? Colors.green : Colors.red),
              label: Text(st.open ? 'Abiertas · cierre ${st.cutoff}' : 'Reservas cerradas'),
              onPressed: () => context.go('/admin/mas/horarios'),
            ),
            ActionChip(
              avatar: const Icon(Icons.cloud_outlined, size: 16),
              label: Text(st.driveEnabled ? 'Drive: ${st.driveUploaded} subidas${st.driveFailed > 0 ? ' · ⚠️ ${st.driveFailed}' : ''}' : 'Drive sin configurar'),
              onPressed: () => context.go('/admin/mas/cuenta'),
            ),
          ]),
          const SizedBox(height: 16),
          // Lo que la cocina debe preparar
          Container(
            decoration: BoxDecoration(gradient: Brand.heroGradient, borderRadius: BorderRadius.circular(24)),
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Para mañana · ${longDate(st.tomorrow).toLowerCase()}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
              Text('${tomorrow?.reservas ?? 0} reservas · sin contar rechazadas', style: const TextStyle(color: Brand.green300, fontSize: 12)),
              const SizedBox(height: 16),
              Row(children: [
                for (final m in Meal.values)
                  Expanded(
                    child: Column(children: [
                      Text(m.emoji, style: const TextStyle(fontSize: 24)),
                      AnimatedCount(tomorrow?.qty[m] ?? 0, style: const TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.w800)),
                      Text('${m.label}s', style: const TextStyle(color: Brand.green300, fontSize: 12)),
                    ]),
                  ),
              ]),
              if (st.nextServiceDate != st.tomorrow)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text('Las nuevas reservas ya son para el ${longDate(st.nextServiceDate).toLowerCase()}.',
                      style: const TextStyle(color: Brand.green100, fontSize: 12)),
                ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: Brand.gold, foregroundColor: Brand.ink, minimumSize: const Size(0, 46)),
                  onPressed: () => context.go('/admin/reservas?date=${st.tomorrow}'),
                  child: const Text('Ver registrados de mañana'),
                ),
              ),
            ]),
          ).animate().fadeIn().slideY(begin: 0.1),
          const SizedBox(height: 14),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.35,
            children: [
              Tile(
                label: 'Por verificar',
                highlight: st.pendingCount > 0,
                sub: '${money(st.pendingCents)} en espera',
                onTap: () => context.go('/admin/reservas?estado=pendiente'),
                child: AnimatedCount(st.pendingCount),
              ),
              Tile(label: 'Recaudado 14 días', sub: 'Pagos aprobados', child: AnimatedCount(st.aprobadoCents, money: true)),
              Tile(label: 'Ranchos 14 días', sub: '${st.reservas} reservas', child: AnimatedCount(st.ranchos)),
              Tile(
                label: 'Personas',
                sub: st.tasaAprobacion == null ? 'Sin pagos revisados' : '${(st.tasaAprobacion! * 100).round()}% aprobados',
                child: AnimatedCount(st.personas),
              ),
            ].animate(interval: 70.ms).fadeIn().scale(begin: const Offset(0.95, 0.95)),
          ),
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Ranchos por día', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                Text('Últimos 14 días y reservas futuras · toca una barra', style: TextStyle(fontSize: 12, color: context.muted)),
                const SizedBox(height: 12),
                MealsByDayChart(days: st.daily, highlight: st.tomorrow),
              ]),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Quiénes más reservan', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                if (st.topPeople.isEmpty) Text('Aún no hay reservas.', style: TextStyle(color: context.muted)),
                for (final (i, p) in st.topPeople.indexed)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(backgroundColor: context.subtle, child: Text('${i + 1}', style: const TextStyle(fontWeight: FontWeight.w800))),
                    title: Text(p.fullName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('${p.reservas} reservas · ${money(p.aprobadoCents)} pagado'),
                    trailing: Text('${p.ranchos}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  ),
              ]),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('¿A qué hora reservan?', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                Text('Reservas por hora del día (14 días)', style: TextStyle(fontSize: 12, color: context.muted)),
                const SizedBox(height: 12),
                HourChart(byHour: st.byHour),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}
