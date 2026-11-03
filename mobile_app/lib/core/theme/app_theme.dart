import 'package:flutter/material.dart';

class AppTheme {
  static const Color primaryGreen = Color(0xFF0F7A4D);
  static const Color greenDark = Color(0xFF0A5A39);
  static const Color greenLight = Color(0xFFE8F5EE);
  static const Color yellow = Color(0xFFF2B43A);
  static const Color authBackground = Color(0xFFF8FAFC);
  static const Color ink = Color(0xFF17212B);
  static const Color tint50 = Color(0xFFF1FAF6);
  static const Color tint100 = Color(0xFFE4F3EC);
  static const Color tint200 = Color(0xFFCDE8DA);
  static const Color tint300 = Color(0xFF9FD6BA);
  static const Color tint400 = Color(0xFF5DB890);
  static const Color canvas = Color(0xFFF3F6F4);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFF7F9F8);
  static const Color inkSoft = Color(0xFF44525F);

  // Retained aliases for existing screens while they use the canonical palette.
  static const Color institutionalBlue = greenDark;
  static const Color softWhite = canvas;
  static const Color darkText = ink;

  static ThemeData get lightTheme {
    final base = ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: canvas,
      colorScheme: const ColorScheme.light(
        primary: primaryGreen,
        onPrimary: surface,
        primaryContainer: tint100,
        onPrimaryContainer: greenDark,
        secondary: yellow,
        onSecondary: ink,
        secondaryContainer: tint50,
        onSecondaryContainer: ink,
        surface: surface,
        onSurface: ink,
        surfaceContainerLow: surfaceMuted,
        outline: tint200,
        error: Color(0xFFB3261E),
        onError: surface,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: greenDark,
        foregroundColor: surface,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: tint200),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryGreen, width: 2),
        ),
        filled: true,
        fillColor: surface,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: primaryGreen,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryGreen,
          foregroundColor: surface,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primaryGreen,
          foregroundColor: surface,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryGreen,
          backgroundColor: Colors.transparent,
          side: const BorderSide(color: primaryGreen),
        ),
      ),
    );

    return base.copyWith(
      textTheme: base.textTheme.apply(bodyColor: ink, displayColor: ink),
    );
  }
}
