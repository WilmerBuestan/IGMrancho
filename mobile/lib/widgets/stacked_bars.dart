import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/meals.dart';
import '../core/models.dart';
import '../core/theme.dart';

/// Ranchos por día apilados por tipo: leyenda, tooltip al tocar y separación entre segmentos.
class MealsByDayChart extends StatelessWidget {
  const MealsByDayChart({super.key, required this.days, this.highlight, this.height = 220});
  final List<DayStat> days;
  final String? highlight;
  final double height;

  @override
  Widget build(BuildContext context) {
    final maxV = days.fold<int>(0, (a, d) => d.ranchos > a ? d.ranchos : a);
    final maxY = maxV <= 4 ? 4.0 : (maxV * 1.2).ceilToDouble();
    final barW = days.length > 20 ? 6.0 : (days.length > 10 ? 10.0 : 16.0);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Wrap(spacing: 16, runSpacing: 4, children: [
        for (final m in Meal.values)
          Row(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 12, height: 12, decoration: BoxDecoration(color: m.color, borderRadius: BorderRadius.circular(3))),
            const SizedBox(width: 6),
            Text(m.label, style: const TextStyle(fontSize: 13)),
          ]),
      ]),
      const SizedBox(height: 16),
      SizedBox(
        height: height,
        child: BarChart(
          BarChartData(
            maxY: maxY,
            alignment: BarChartAlignment.spaceAround,
            borderData: FlBorderData(show: false),
            gridData: FlGridData(
              drawVerticalLine: false,
              horizontalInterval: maxY / 4,
              getDrawingHorizontalLine: (_) => FlLine(color: context.isDark ? Colors.white12 : Brand.green100, strokeWidth: 1, dashArray: [4, 4]),
            ),
            titlesData: FlTitlesData(
              topTitles: const AxisTitles(),
              rightTitles: const AxisTitles(),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 28,
                  interval: maxY / 4,
                  getTitlesWidget: (v, _) => Text('${v.round()}', style: TextStyle(fontSize: 10, color: context.muted)),
                ),
              ),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 22,
                  getTitlesWidget: (v, _) {
                    final i = v.toInt();
                    if (i < 0 || i >= days.length) return const SizedBox.shrink();
                    final d = parseDay(days[i].date);
                    if (days.length > 16 && d.day % 5 != 1) return const SizedBox.shrink();
                    final hl = days[i].date == highlight;
                    return Text('${d.day}',
                        style: TextStyle(fontSize: 10, fontWeight: hl ? FontWeight.w800 : FontWeight.w400, color: hl ? context.colors.onSurface : context.muted));
                  },
                ),
              ),
            ),
            barTouchData: BarTouchData(
              touchTooltipData: BarTouchTooltipData(
                getTooltipColor: (_) => context.isDark ? const Color(0xFF263322) : Colors.white,
                tooltipBorder: BorderSide(color: context.isDark ? Colors.white24 : Brand.green100),
                getTooltipItem: (g, _, _, _) {
                  final d = days[g.x];
                  final txt = TextStyle(color: context.colors.onSurface, fontSize: 12);
                  return BarTooltipItem('${shortDate(d.date)}\n', txt.copyWith(fontWeight: FontWeight.w700), children: [
                    for (final m in Meal.values) TextSpan(text: '${m.label}: ${d.qty[m]}\n', style: txt),
                    TextSpan(text: 'Total: ${d.ranchos}', style: txt.copyWith(fontWeight: FontWeight.w700)),
                  ]);
                },
              ),
            ),
            barGroups: [
              for (var i = 0; i < days.length; i++) _group(i, days[i], barW, context),
            ],
          ),
          duration: const Duration(milliseconds: 500),
        ),
      ),
    ]);
  }

  BarChartGroupData _group(int i, DayStat d, double w, BuildContext context) {
    const gap = 0.12; // separación visual entre segmentos (en unidades del eje)
    final items = <BarChartRodStackItem>[];
    var y = 0.0;
    final present = Meal.values.where((m) => (d.qty[m] ?? 0) > 0).toList();
    for (var k = 0; k < present.length; k++) {
      final v = d.qty[present[k]]!.toDouble();
      final top = y + v - (k < present.length - 1 ? gap : 0);
      items.add(BarChartRodStackItem(y, top, present[k].color));
      y += v;
    }
    return BarChartGroupData(x: i, barRods: [
      BarChartRodData(
        toY: d.ranchos.toDouble(),
        width: w,
        color: Colors.transparent,
        rodStackItems: items,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
      ),
    ]);
  }
}

/// Reservas por hora del día (una sola serie).
class HourChart extends StatelessWidget {
  const HourChart({super.key, required this.byHour});
  final Map<int, int> byHour;
  @override
  Widget build(BuildContext context) {
    final maxV = byHour.values.fold<int>(0, (a, b) => b > a ? b : a);
    return SizedBox(
      height: 150,
      child: BarChart(BarChartData(
        maxY: maxV <= 4 ? 4 : maxV * 1.2,
        borderData: FlBorderData(show: false),
        gridData: const FlGridData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(),
          rightTitles: const AxisTitles(),
          leftTitles: const AxisTitles(),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 20,
              getTitlesWidget: (v, _) => v % 3 == 0 ? Text('${v.toInt()}h', style: TextStyle(fontSize: 10, color: context.muted)) : const SizedBox.shrink(),
            ),
          ),
        ),
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            getTooltipColor: (_) => context.isDark ? const Color(0xFF263322) : Colors.white,
            getTooltipItem: (g, _, r, _) => BarTooltipItem('${g.x}:00 · ${r.toY.toInt()} reservas',
                TextStyle(color: context.colors.onSurface, fontSize: 12, fontWeight: FontWeight.w600)),
          ),
        ),
        barGroups: [
          for (var h = 0; h < 24; h++)
            BarChartGroupData(x: h, barRods: [
              BarChartRodData(
                toY: (byHour[h] ?? 0).toDouble(),
                width: 7,
                color: context.isDark ? Brand.green300 : Brand.green600,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
              ),
            ]),
        ],
      )),
    );
  }
}
