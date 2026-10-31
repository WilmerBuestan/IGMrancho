import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/meals.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../../widgets/stacked_bars.dart';

/// Descarga el Excel (CSV) y abre el menú de compartir (WhatsApp, Drive, correo…).
Future<void> shareCsv(BuildContext context, String query, String filename) async {
  try {
    final csv = await api.exportCsv(query);
    final dir = await getTemporaryDirectory();
    final f = File('${dir.path}/$filename');
    await f.writeAsString(csv);
    await SharePlus.instance.share(ShareParams(files: [XFile(f.path, mimeType: 'text/csv')], subject: filename));
  } on ApiException catch (e) {
    if (context.mounted) toast(context, e.message, error: true);
  }
}

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String preset = 'semana';
  late String from, to;
  Report? r;
  String? error;
  bool byPerson = false;

  static Map<String, (String, String, String)> _presets() {
    final t = DateTime.now();
    final today = DateTime(t.year, t.month, t.day);
    final monday = today.subtract(Duration(days: today.weekday - 1));
    final first = DateTime(t.year, t.month, 1);
    final lastPrev = first.subtract(const Duration(days: 1));
    return {
      'manana': ('Mañana', isoDay(today.add(const Duration(days: 1))), isoDay(today.add(const Duration(days: 1)))),
      'hoy': ('Hoy', isoDay(today), isoDay(today)),
      'semana': ('Esta semana', isoDay(monday), isoDay(monday.add(const Duration(days: 6)))),
      'mes': ('Este mes', isoDay(first), isoDay(DateTime(t.year, t.month + 1, 0))),
      'mes-pasado': ('Mes pasado', isoDay(DateTime(lastPrev.year, lastPrev.month, 1)), isoDay(lastPrev)),
      '30': ('30 días', isoDay(today.subtract(const Duration(days: 29))), isoDay(today)),
    };
  }

  @override
  void initState() {
    super.initState();
    _pick('semana');
  }

  void _pick(String key) {
    final p = _presets()[key]!;
    setState(() => (preset = key, from = p.$2, to = p.$3));
    _load();
  }

  Future<void> _custom() async {
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2026),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDateRange: DateTimeRange(start: parseDay(from), end: parseDay(to)),
    );
    if (range != null) {
      setState(() => (preset = '', from = isoDay(range.start), to = isoDay(range.end)));
      _load();
    }
  }

  Future<void> _load() async {
    setState(() => error = null);
    try {
      final res = await api.report(from, to);
      if (mounted) setState(() => r = res);
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  int _sum(int Function(DayStat) f) => r?.days.fold<int>(0, (a, d) => a + f(d)) ?? 0;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Row(children: [
            const Expanded(child: Text('Reportes', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800))),
            FilledButton.icon(
              onPressed: () => shareCsv(context, 'from=$from&to=$to', 'igm-rancho-${from}_a_$to.csv'),
              icon: const Icon(Icons.ios_share_rounded, size: 18),
              label: const Text('Excel'),
              style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            ),
          ]),
          Text(from == to ? longDate(from) : '${shortDate(from)} — ${shortDate(to)}', style: TextStyle(color: context.muted)),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              for (final e in _presets().entries)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(label: Text(e.value.$1), selected: preset == e.key, onSelected: (_) => _pick(e.key)),
                ),
              ActionChip(avatar: const Icon(Icons.date_range_rounded, size: 16), label: const Text('Elegir fechas'), onPressed: _custom),
            ]),
          ),
          const SizedBox(height: 14),
          if (error != null) ErrorView(error!, onRetry: _load),
          if (r == null && error == null) const SizedBox(height: 300, child: LoadingList(count: 2)),
          if (r != null) ...[
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.05,
              children: [
                Tile(label: 'Reservas', child: AnimatedCount(_sum((d) => d.reservas))),
                for (final m in Meal.values) Tile(label: '${m.label}s', dot: m.color, child: AnimatedCount(_sum((d) => d.qty[m]!))),
                Tile(label: 'Aprobado', child: FittedBox(child: AnimatedCount(_sum((d) => d.aprobadoCents), money: true))),
                Tile(label: 'Por verificar', child: FittedBox(child: AnimatedCount(_sum((d) => d.pendienteCents), money: true))),
              ],
            ),
            if (r!.days.length > 1 && r!.days.length <= 62) ...[
              const SizedBox(height: 14),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: MealsByDayChart(days: r!.days),
                ),
              ),
            ],
            const SizedBox(height: 14),
            SegmentedButton<bool>(
              segments: [
                const ButtonSegment(value: false, label: Text('Por día'), icon: Icon(Icons.calendar_today_rounded)),
                ButtonSegment(value: true, label: Text('Por persona (${r!.people.length})'), icon: const Icon(Icons.people_alt_rounded)),
              ],
              selected: {byPerson},
              onSelectionChanged: (v) => setState(() => byPerson = v.first),
            ),
            const SizedBox(height: 10),
            if (!byPerson)
              for (final d in r!.days.where((d) => d.reservas > 0 || d.rechazadas > 0))
                Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(longDate(d.date), style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${mealsText(d.qty)}${d.rechazadas > 0 ? ' · ${d.rechazadas} rechazadas' : ''}'),
                    trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(money(d.aprobadoCents), style: const TextStyle(fontWeight: FontWeight.w800)),
                      if (d.pendienteCents > 0) Text('+${money(d.pendienteCents)} pend.', style: TextStyle(fontSize: 11, color: context.muted)),
                    ]),
                  ),
                )
            else
              for (final p in r!.people)
                Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(p.fullName, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${p.cedula} · ${mealsText(p.qty)}'),
                    trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(money(p.aprobadoCents), style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text('${p.reservas} reservas', style: TextStyle(fontSize: 11, color: context.muted)),
                    ]),
                  ),
                ),
            if ((!byPerson && _sum((d) => d.reservas + d.rechazadas) == 0) || (byPerson && r!.people.isEmpty))
              Padding(padding: const EdgeInsets.all(24), child: Text('No hay reservas en este rango.', textAlign: TextAlign.center, style: TextStyle(color: context.muted))),
          ],
        ],
      ),
    );
  }
}
