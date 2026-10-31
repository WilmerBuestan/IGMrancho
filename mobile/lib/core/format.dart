import 'package:intl/intl.dart';

import 'meals.dart';

String money(int cents) => '\$${(cents / 100).toStringAsFixed(2)}';

DateTime parseDay(String d) => DateTime.parse('${d}T12:00:00');
String isoDay(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

/// "Domingo, 1 de noviembre"
String longDate(String d) => _cap(DateFormat("EEEE, d 'de' MMMM", 'es').format(parseDay(d)));

/// "dom 1 nov"
String shortDate(String d) => DateFormat('EEE d MMM', 'es').format(parseDay(d)).replaceAll('.', '');

String mealsText(Qty q) => Meal.values
    .where((m) => (q[m] ?? 0) > 0)
    .map((m) => '${q[m]} ${m.label.toLowerCase()}${q[m]! > 1 ? 's' : ''}')
    .join(' · ');

/// Misma validación de cédula ecuatoriana que el servidor.
bool isValidCedula(String c) {
  if (!RegExp(r'^\d{10}$').hasMatch(c)) return false;
  final p = int.parse(c.substring(0, 2));
  if (!((p >= 1 && p <= 24) || p == 30) || int.parse(c[2]) >= 6) return false;
  var sum = 0;
  for (var i = 0; i < 9; i++) {
    var d = int.parse(c[i]) * (i.isEven ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return (10 - sum % 10) % 10 == int.parse(c[9]);
}

String greeting() {
  final h = DateTime.now().hour;
  return h < 12 ? 'Buenos días' : (h < 19 ? 'Buenas tardes' : 'Buenas noches');
}
