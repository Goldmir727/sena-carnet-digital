import 'dart:convert';

import '../core/http/api_client.dart';
import 'auth_service.dart';

class EventQr {
  const EventQr({
    required this.id,
    required this.name,
    required this.qrToken,
    required this.expiresAt,
  });

  final int id;
  final String name;
  final String qrToken;
  final DateTime expiresAt;

  factory EventQr.fromJson(Map<String, dynamic> json) {
    return EventQr(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      qrToken: json['qr_token'] as String,
      expiresAt: DateTime.parse(json['qr_expires_at'] as String).toLocal(),
    );
  }
}

class EventService {
  EventService({ApiClient? apiClient, AuthService? authService})
    : _apiClient = apiClient ?? ApiClient(),
      _authService = authService ?? AuthService();

  final ApiClient _apiClient;
  final AuthService _authService;

  Future<String> _requireToken() async {
    final token = await _authService.getToken();
    if (token == null || token.isEmpty) {
      throw Exception('La sesión ha expirado.');
    }
    return token;
  }

  Future<List<String>> getSavedNames() async {
    final response = await _apiClient.get(
      '/eventos/nombres',
      token: await _requireToken(),
    );
    final data = response.body.isNotEmpty
        ? jsonDecode(response.body)
        : <dynamic>[];
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_detail(data, 'No se pudieron cargar los eventos.'));
    }
    if (data is! List) {
      throw Exception('La respuesta de eventos no tiene un formato válido.');
    }
    return data.whereType<String>().toList();
  }

  Future<List<EventQr>> getActiveEvents() async {
    final response = await _apiClient.get(
      '/eventos/activos',
      token: await _requireToken(),
    );
    final data = response.body.isNotEmpty
        ? jsonDecode(response.body)
        : <dynamic>[];
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _detail(data, 'No se pudieron cargar los eventos activos.'),
      );
    }
    if (data is! List) {
      throw Exception('La respuesta de eventos no tiene un formato válido.');
    }
    return data
        .map((item) => EventQr.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<EventQr> createEvent(String name) async {
    final response = await _apiClient.post('/eventos/', {
      'name': name,
    }, token: await _requireToken());
    final data = _decodeMap(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_detail(data, 'No se pudo crear el evento.'));
    }
    return EventQr.fromJson(data);
  }

  Future<void> closeEvent(int eventId) async {
    final response = await _apiClient.post(
      '/eventos/$eventId/cerrar',
      {},
      token: await _requireToken(),
    );
    final data = _decodeMap(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_detail(data, 'No se pudo cerrar el evento.'));
    }
  }

  Map<String, dynamic> _decodeMap(String body) {
    if (body.isEmpty) return <String, dynamic>{};
    final decoded = jsonDecode(body);
    return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
  }

  String _detail(dynamic data, String fallback) {
    if (data is Map<String, dynamic> && data['detail'] is String) {
      return data['detail'] as String;
    }
    return fallback;
  }
}
