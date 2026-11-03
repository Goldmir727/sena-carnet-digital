import 'dart:convert';

import '../core/http/api_client.dart';
import '../models/carnet_details.dart';
import 'auth_service.dart';

class CarnetNotAssignedException implements Exception {
  const CarnetNotAssignedException();
}

class CarnetService {
  CarnetService({ApiClient? apiClient, AuthService? authService})
      : _apiClient = apiClient ?? ApiClient(),
        _authService = authService ?? AuthService();

  final ApiClient _apiClient;
  final AuthService _authService;

  Future<CarnetDetails> getMine() async {
    final token = await _authService.getToken();
    if (token == null || token.isEmpty) {
      throw Exception('La sesión ha expirado.');
    }

    final response = await _apiClient.get('/carnets/me', token: token);
    final data = response.body.isNotEmpty
        ? jsonDecode(response.body) as Map<String, dynamic>
        : <String, dynamic>{};

    if (response.statusCode == 404) {
      throw const CarnetNotAssignedException();
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(data['detail'] ?? 'No se pudo cargar el carnet.');
    }

    return CarnetDetails.fromJson(data);
  }
}