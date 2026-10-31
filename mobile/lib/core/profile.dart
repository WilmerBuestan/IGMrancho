import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'meals.dart';

/// Datos de la persona y su última reserva, guardados en el celular.
class Profile extends ChangeNotifier {
  Profile._();
  static final instance = Profile._();

  late SharedPreferences _p;
  String fullName = '';
  String cedula = '';
  String email = '';
  bool reminders = true;
  Qty? lastOrder;

  bool get complete => cedula.isNotEmpty && email.isNotEmpty;

  Future<void> load() async {
    _p = await SharedPreferences.getInstance();
    fullName = _p.getString('fullName') ?? '';
    cedula = _p.getString('cedula') ?? '';
    email = _p.getString('email') ?? '';
    reminders = _p.getBool('reminders') ?? true;
    final o = _p.getString('lastOrder');
    if (o != null) {
      final m = jsonDecode(o) as Map<String, dynamic>;
      lastOrder = {for (final meal in Meal.values) meal: (m[meal.name] ?? 0) as int};
    }
  }

  Future<void> save({required String fullName, required String cedula, required String email, Qty? order}) async {
    this.fullName = fullName;
    this.cedula = cedula;
    this.email = email;
    await _p.setString('fullName', fullName);
    await _p.setString('cedula', cedula);
    await _p.setString('email', email);
    if (order != null) {
      lastOrder = Map.of(order);
      await _p.setString('lastOrder', jsonEncode({for (final e in order.entries) e.key.name: e.value}));
    }
    notifyListeners();
  }

  Future<void> setReminders(bool v) async {
    reminders = v;
    await _p.setBool('reminders', v);
    notifyListeners();
  }

  Future<void> clear() async {
    fullName = cedula = email = '';
    lastOrder = null;
    for (final k in ['fullName', 'cedula', 'email', 'lastOrder']) {
      await _p.remove(k);
    }
    notifyListeners();
  }
}

final profile = Profile.instance;
