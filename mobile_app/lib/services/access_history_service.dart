import 'dart:convert';

import '../core/http/api_client.dart';
import '../models/access_record.dart';
import 'auth_service.dart';

class AccessHistoryService {
  AccessHistoryService({ApiClient? apiClient, AuthService? authService})
      : _apiClient = apiClient ?? ApiClient(),
        _authService = authService ?? AuthService();

  final ApiClient _apiClient;
  final AuthService _authService;

  Future<List<AccessRecord>> getMine() async {
    final token = await _authService.getToken();
    if (token == null || token.isEmpty) {
      throw Exception('La sesión ha expirado.');
    }

    final response = await _apiClient.get('/validate/access-history/me', token: token);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('No se pudo cargar el historial de accesos.');
    }
    final data = jsonDecode(response.body) as List<dynamic>;
    return data
        .whereType<Map<String, dynamic>>()
        .map(AccessRecord.fromJson)
        .toList();
  }
}