import 'dart:convert';

import '../core/http/api_client.dart';
import 'auth_service.dart';

class CarnetQr {
  const CarnetQr({required this.token, required this.expiresAt});

  final String token;
  final DateTime? expiresAt;

  factory CarnetQr.fromJson(Map<String, dynamic> json) {
    return CarnetQr(
      token: json['qr_token'] as String? ?? '',
      expiresAt: DateTime.tryParse(json['expires_at'] as String? ?? ''),
    );
  }
}

class QrService {
  QrService({ApiClient? apiClient, AuthService? authService})
    : _apiClient = apiClient ?? ApiClient(),
      _authService = authService ?? AuthService();

  final ApiClient _apiClient;
  final AuthService _authService;

  Future<Map<String, dynamic>> generateClassQr({
    required int groupId,
    required String activity,
  }) async {
    final token = await _authService.getToken();
    if (token == null || token.isEmpty) {
      throw Exception('La sesión ha expirado.');
    }

    final now = DateTime.now();
    var start = DateTime(now.year, now.month, now.day, now.hour, now.minute);
    final proposedEnd = start.add(const Duration(minutes: 30));
    var end = proposedEnd.day == start.day
        ? proposedEnd
        : DateTime(now.year, now.month, now.day, 23, 59);
    if (!end.isAfter(start)) {
      start = DateTime(now.year, now.month, now.day, 23, 58);
      end = DateTime(now.year, now.month, now.day, 23, 59);
    }
    final sessionResponse = await _apiClient.post('/sesiones/', {
      'ficha_id': groupId,
      'session_date': _date(now),
      'start_time': _time(start),
      'end_time': _time(end),
      'description': activity,
    }, token: token);
    final session = sessionResponse.body.isNotEmpty
        ? jsonDecode(sessionResponse.body) as Map<String, dynamic>
        : <String, dynamic>{};

    if (sessionResponse.statusCode < 200 || sessionResponse.statusCode >= 300) {
      throw Exception(
        session['detail'] ?? 'No se pudo crear la sesión de asistencia.',
      );
    }

    final sessionId = (session['id'] as num?)?.toInt();
    if (sessionId == null) {
      throw Exception('No se pudo iniciar la asistencia.');
    }

    final qrResponse = await _apiClient.post(
      '/sesiones/$sessionId/qr',
      {},
      token: token,
    );
    final qrData = qrResponse.body.isNotEmpty
        ? jsonDecode(qrResponse.body) as Map<String, dynamic>
        : <String, dynamic>{};

    if (qrResponse.statusCode < 200 || qrResponse.statusCode >= 300) {
      throw Exception(qrData['detail'] ?? 'No se pudo generar el QR de clase.');
    }

    return {
      ...qrData,
      'sesion_id': sessionId,
      'grupo': session['ficha_number'] ?? 'Ficha $groupId',
      'docente': session['instructor_nombre'] ?? '',
    };
  }

  String _date(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';

  String _time(DateTime date) =>
      '${date.hour.toString().padLeft(2, '0')}:'
      '${date.minute.toString().padLeft(2, '0')}:00';

  Future<CarnetQr> generateCarnetQr() async {
    final token = await _authService.getToken();
    if (token == null || token.isEmpty) {
      throw Exception('La sesión ha expirado.');
    }

    final response = await _apiClient.post('/qr/carnet', {}, token: token);
    final data = response.body.isNotEmpty
        ? jsonDecode(response.body) as Map<String, dynamic>
        : <String, dynamic>{};

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(data['detail'] ?? 'No se pudo generar el QR del carnet.');
    }

    final qr = CarnetQr.fromJson(data);
    if (qr.token.isEmpty) {
      throw Exception('No se pudo generar el código QR del carnet.');
    }
    return qr;
  }

  Future<void> closeClassSession({required int sessionId}) async {
    final token = await _authService.getToken();
    if (token == null || token.isEmpty) {
      throw Exception('La sesión ha expirado.');
    }

    final response = await _apiClient.put('/sesiones/$sessionId', {
      'status': 'realizada',
    }, token: token);
    final data = response.body.isNotEmpty
        ? jsonDecode(response.body) as Map<String, dynamic>
        : <String, dynamic>{};

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(data['detail'] ?? 'No se pudo cerrar la asistencia.');
    }
  }
}
