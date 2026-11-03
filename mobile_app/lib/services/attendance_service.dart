import 'dart:convert';

import '../core/http/api_client.dart';
import 'auth_service.dart';

class AttendanceResult {
  const AttendanceResult({
    required this.success,
    required this.message,
    this.data,
  });

  final bool success;
  final String message;
  final Map<String, dynamic>? data;
}

class AttendanceService {
  AttendanceService({ApiClient? apiClient, AuthService? authService})
    : _apiClient = apiClient ?? ApiClient(),
      _authService = authService ?? AuthService();

  final ApiClient _apiClient;
  final AuthService _authService;

  Future<List<Map<String, dynamic>>> getGroupRecords({
    required int groupId,
    String? date,
  }) async {
    final token = await _authService.getToken();
    if (token == null || token.isEmpty) {
      throw Exception('La sesión ha expirado.');
    }

    final response = await _apiClient.get(
      '/asistencia/grupo/$groupId',
      token: token,
      queryParameters: date == null ? null : {'fecha': date},
    );
    final data = response.body.isNotEmpty
        ? jsonDecode(response.body)
        : <dynamic>[];

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        data is Map<String, dynamic>
            ? data['detail'] ?? 'No se pudieron cargar las asistencias.'
            : 'No se pudieron cargar las asistencias.',
      );
    }

    return (data as List<dynamic>)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Future<Map<String, dynamic>> getGroupStats({required int groupId}) async {
    final token = await _authService.getToken();
    if (token == null || token.isEmpty) {
      throw Exception('La sesión ha expirado.');
    }

    final response = await _apiClient.get(
      '/asistencia/grupo/$groupId/stats',
      token: token,
    );
    final data = response.body.isNotEmpty
        ? jsonDecode(response.body) as Map<String, dynamic>
        : <String, dynamic>{};

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        data['detail'] ?? 'No se pudieron cargar las estadísticas.',
      );
    }

    return data;
  }

  Future<AttendanceResult> validateQr(String qrToken) async {
    final token = await _authService.getToken();

    if (token == null || token.isEmpty) {
      return const AttendanceResult(
        success: false,
        message: 'Debes iniciar sesión para registrar asistencia.',
      );
    }

    try {
      final response = await _apiClient.post('/asistencia/escanear', {
        'qr_token': qrToken,
      }, token: token);

      Map<String, dynamic> body = {};
      if (response.body.isNotEmpty) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          body = decoded;
        }
      }

      final message = _messageFor(response.statusCode, body);
      return AttendanceResult(
        success: response.statusCode >= 200 && response.statusCode < 300,
        message: message,
        data: body,
      );
    } catch (_) {
      return const AttendanceResult(
        success: false,
        message:
            'No pudimos comunicarnos. Revisa tu conexión e inténtalo de nuevo.',
      );
    }
  }

  String _messageFor(int statusCode, Map<String, dynamic> body) {
    final detail = body['detail'];
    if (detail is String && detail.isNotEmpty) {
      return detail;
    }

    if (statusCode >= 200 && statusCode < 300) {
      return 'Asistencia registrada correctamente.';
    }
    if (statusCode == 401 || statusCode == 403) {
      return 'Tu sesión no está autorizada. Inicia sesión nuevamente.';
    }
    return 'No fue posible validar el código QR.';
  }
}
