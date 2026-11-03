import 'dart:convert';

import '../core/http/api_client.dart';
import '../models/training_group.dart';
import 'auth_service.dart';

class GroupService {
  GroupService({ApiClient? apiClient, AuthService? authService})
      : _apiClient = apiClient ?? ApiClient(),
        _authService = authService ?? AuthService();

  final ApiClient _apiClient;
  final AuthService _authService;

  Future<List<TrainingGroup>> getMyGroups() async {
    final token = await _authService.getToken();
    if (token == null || token.isEmpty) {
      throw Exception('La sesión ha expirado.');
    }

    final response = await _apiClient.get('/grupos/mis-grupos', token: token);
    final decoded = response.body.isNotEmpty ? jsonDecode(response.body) : [];

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final detail = decoded is Map<String, dynamic> ? decoded['detail'] : null;
      throw Exception(detail ?? 'No se pudieron cargar los grupos.');
    }

    if (decoded is! List) {
      throw Exception('La respuesta de grupos no tiene un formato válido.');
    }

    return decoded
        .map((item) => TrainingGroup.fromJson(item as Map<String, dynamic>))
        .where((group) => group.id > 0 && group.name.isNotEmpty)
        .toList();
  }
}
