import 'package:flutter/foundation.dart';

class AppConstants {
  static const String appName = 'Carnet Digital - SENA';

  static const String _configuredApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
  );

  static const String _prodApiBaseUrl =
      'https://3pvyvleulkjypce5tlhuytxn.93.127.217.129.sslip.io/api';

  static String get apiBaseUrl {
    if (_configuredApiBaseUrl.isNotEmpty) return _configuredApiBaseUrl;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return _prodApiBaseUrl;
    }
    return 'http://localhost:8000';
  }
}
