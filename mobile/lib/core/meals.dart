import 'package:flutter/material.dart';

enum Meal {
  desayuno('Desayuno', '☕', Color(0xFF2A78D6)),
  almuerzo('Almuerzo', '🍛', Color(0xFFEB6834)),
  merienda('Merienda', '🍲', Color(0xFF1BAF7A));

  const Meal(this.label, this.emoji, this.color);
  final String label;
  final String emoji;
  // Colores de serie validados para daltonismo (mismos que la web)
  final Color color;
}

typedef Qty = Map<Meal, int>;

Qty emptyQty() => {for (final m in Meal.values) m: 0};
