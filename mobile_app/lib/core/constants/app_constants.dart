import 'package:flutter/foundation.dart';

class AppConstants {
  static const String appName = 'SENA Carnet Digital';
  static const String _configuredApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
  );

  static String get apiBaseUrl {
    if (_configuredApiBaseUrl.isNotEmpty) return _configuredApiBaseUrl;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8000';
    }
    return 'http://localhost:8000';
  }

  static const int primaryColorValue = 0xFF0F7A4D;
  static const int accentColorValue = 0xFFF2B43A;

}
