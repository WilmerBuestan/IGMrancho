import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class Brand {
  static const green900 = Color(0xFF263322);
  static const green800 = Color(0xFF2E3D28);
  static const green700 = Color(0xFF384C2F);
  static const green600 = Color(0xFF476139);
  static const green500 = Color(0xFF5C7B4A);
  static const green300 = Color(0xFF9FB78E);
  static const green100 = Color(0xFFE2EADC);
  static const green50 = Color(0xFFF3F6F1);
  static const gold = Color(0xFFECBD45);
  static const goldLight = Color(0xFFF3D27A);
  static const ink = Color(0xFF121A10);
  static const danger = Color(0xFFC62828);

  static const heroGradient = RadialGradient(
    center: Alignment(0, -1.1),
    radius: 1.5,
    colors: [Color(0xFF476139), Color(0xFF263322), Color(0xFF121A10)],
    stops: [0, 0.45, 1],
  );
}

ThemeData buildTheme(Brightness b) {
  final dark = b == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: Brand.green600,
    brightness: b,
    primary: dark ? Brand.green300 : Brand.green800,
    onPrimary: dark ? Brand.ink : Colors.white,
    secondary: Brand.gold,
    onSecondary: Brand.ink,
    surface: dark ? const Color(0xFF161D14) : Colors.white,
    error: Brand.danger,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: b);
  final text = GoogleFonts.interTextTheme(base.textTheme);
  final radius = BorderRadius.circular(16);
  return base.copyWith(
    scaffoldBackgroundColor: dark ? const Color(0xFF0E130C) : Brand.green50,
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? const Color(0xFF0E130C) : Brand.green900,
      foregroundColor: Colors.white,
      elevation: 0,
      titleTextStyle: GoogleFonts.inter(fontSize: 19, fontWeight: FontWeight.w800, color: Colors.white),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      color: scheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: dark ? Colors.white10 : Brand.green900.withValues(alpha: 0.06)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0xFF1C2519) : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: dark ? Colors.white24 : Brand.green100)),
      enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: dark ? Colors.white24 : Brand.green100)),
      focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: scheme.primary, width: 2)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(64, 54),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(64, 50),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w600),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surface,
      indicatorColor: dark ? Brand.green700 : Brand.green100,
      labelTextStyle: WidgetStatePropertyAll(GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600)),
    ),
    snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: radius)),
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
    }),
  );
}

extension ThemeX on BuildContext {
  ColorScheme get colors => Theme.of(this).colorScheme;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
  Color get muted => isDark ? Colors.white60 : const Color(0xFF5C7B4A);
  Color get subtle => isDark ? Colors.white10 : Brand.green50;
}
