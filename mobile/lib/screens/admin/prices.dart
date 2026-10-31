import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/format.dart';
import '../../core/meals.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import 'settings_base.dart';

class PricesScreen extends StatefulWidget {
  const PricesScreen({super.key});
  @override
  State<PricesScreen> createState() => _PricesScreenState();
}

class _PricesScreenState extends SettingsPageState<PricesScreen> {
  final prices = {for (final m in Meal.values) m: TextEditingController()};
  final notice = TextEditingController();

  @override
  void apply(AdminSettings s) {
    for (final m in Meal.values) {
      prices[m]!.text = (s.prices[m]! / 100).toStringAsFixed(2);
    }
    notice.text = s.notice;
  }

  int _cents(Meal m) => ((double.tryParse(prices[m]!.text.replaceAll(',', '.')) ?? 0) * 100).round();

  @override
  Widget build(BuildContext context) => page(
        'Precios y menú',
        [
          Text('Las reservas ya hechas mantienen su precio.', style: TextStyle(color: context.muted)),
          const SizedBox(height: 12),
          for (final m in Meal.values)
            Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(children: [
                  Text(m.emoji, style: const TextStyle(fontSize: 30)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(m.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      if (settings != null) Text('Actual: ${money(settings!.prices[m]!)}', style: TextStyle(color: context.muted, fontSize: 12)),
                    ]),
                  ),
                  SizedBox(
                    width: 120,
                    child: TextField(
                      controller: prices[m],
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                      textAlign: TextAlign.right,
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                      decoration: const InputDecoration(prefixText: '\$ '),
                    ),
                  ),
                ]),
              ),
            ),
          const SizedBox(height: 8),
          const Text('Menú del día / aviso', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          Text('Se muestra arriba en la pantalla de reservas.', style: TextStyle(color: context.muted, fontSize: 13)),
          const SizedBox(height: 8),
          TextField(
            controller: notice,
            maxLines: 5,
            decoration: const InputDecoration(hintText: 'Desayuno: bolón con café\nAlmuerzo: seco de pollo\nMerienda: arroz con menestra'),
          ),
        ],
        onSave: () => save({
          'prices': {for (final m in Meal.values) m.name: _cents(m)},
          'notice': notice.text,
        }),
      );
}
