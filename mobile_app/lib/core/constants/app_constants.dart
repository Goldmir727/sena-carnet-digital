import 'package:flutter/foundation.dart';

class AppConstants {
  static const String appName = 'Carnet Digital - SENA';

  static const String _configuredApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
  );

  // API pública en el VPS. Sin barra final y sin /api: el backend sirve sus
  // rutas en la raíz del subdominio (ej. /auth/login).
  static const String _prodApiBaseUrl = 'https://api.carnetisena.com';

  static String get apiBaseUrl {
    if (_configuredApiBaseUrl.isNotEmpty) return _configuredApiBaseUrl;
    if (kReleaseMode) return _prodApiBaseUrl;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return _prodApiBaseUrl;
    }
    return 'http://localhost:8000';
  }
}
