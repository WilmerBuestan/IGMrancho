import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import 'settings_base.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});
  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends SettingsPageState<ScheduleScreen> {
  bool open = true;
  String cutoff = '20:00';
  int reminder = 60;
  List<String> closed = [];

  @override
  void apply(AdminSettings s) => setState(() {
        open = s.open;
        cutoff = s.cutoff;
        reminder = s.reminderMinutes;
        closed = [...s.closedDates];
      });

  Future<void> _pickTime() async {
    final p = cutoff.split(':');
    final t = await showTimePicker(context: context, initialTime: TimeOfDay(hour: int.parse(p[0]), minute: int.parse(p[1])));
    if (t != null) setState(() => cutoff = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}');
  }

  Future<void> _addDate() async {
    final now = DateTime.now();
    final d = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 365)), helpText: 'Día sin servicio');
    if (d != null && !closed.contains(isoDay(d))) setState(() => closed = [...closed, isoDay(d)]..sort());
  }

  @override
  Widget build(BuildContext context) {
    final today = isoDay(DateTime.now());
    final next14 = [for (var i = 1; i <= 14; i++) isoDay(DateTime.now().add(Duration(days: i)))];
    return page(
      'Fechas y horarios',
      [
        Card(
          child: SwitchListTile(
            title: const Text('Recibir reservas', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('Apágalo para cerrar las reservas por completo'),
            value: open,
            onChanged: (v) => setState(() => open = v),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            title: const Text('Hora límite', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text('Para comer el martes hay que reservar hasta el lunes a las $cutoff'),
            trailing: FilledButton.tonal(onPressed: _pickTime, child: Text(cutoff, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Recordatorio push', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              Text(
                reminder == 0 ? 'Apagado' : 'Se envía $reminder min antes de la hora límite, solo a quien aún no reservó',
                style: TextStyle(color: context.muted, fontSize: 13),
              ),
              Slider(
                value: reminder.toDouble(),
                min: 0,
                max: 180,
                divisions: 12,
                label: reminder == 0 ? 'Apagado' : '$reminder min',
                onChanged: (v) => setState(() => reminder = v.round()),
              ),
              if (settings != null && !settings!.pushEnabled)
                Text('⚠️ El servidor aún no tiene la llave de Firebase: no se envían notificaciones.',
                    style: TextStyle(color: context.muted, fontSize: 12)),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Días sin servicio', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              Text('Feriados, francos o días sin cocina. Toca un día para bloquearlo.', style: TextStyle(color: context.muted, fontSize: 13)),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 7,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                children: [
                  for (final d in next14)
                    Builder(builder: (_) {
                      final off = closed.contains(d);
                      final dt = parseDay(d);
                      return InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () => setState(() => closed = off ? (closed..remove(d)).toList() : ([...closed, d]..sort())),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          decoration: BoxDecoration(
                            color: off ? Brand.danger.withValues(alpha: 0.12) : context.subtle,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: off ? Brand.danger.withValues(alpha: 0.5) : Colors.transparent),
                          ),
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Text(['L', 'M', 'M', 'J', 'V', 'S', 'D'][dt.weekday - 1], style: TextStyle(fontSize: 10, color: context.muted)),
                            Text('${dt.day}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: off ? Brand.danger : null,
                                  decoration: off ? TextDecoration.lineThrough : null,
                                )),
                          ]),
                        ),
                      );
                    }),
                ],
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(onPressed: _addDate, icon: const Icon(Icons.add_rounded), label: const Text('Agregar otra fecha')),
              for (final d in closed.where((d) => d.compareTo(today) >= 0))
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.block_rounded, color: Brand.danger, size: 20),
                  title: Text(longDate(d)),
                  trailing: IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => setState(() => closed = (closed..remove(d)).toList())),
                ),
            ]),
          ),
        ),
      ],
      onSave: () => save({'open': open, 'cutoff': cutoff, 'reminderMinutes': reminder, 'closedDates': closed}),
    );
  }
}
