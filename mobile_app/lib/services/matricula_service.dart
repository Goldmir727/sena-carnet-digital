import 'dart:convert';

import '../core/http/api_client.dart';
import '../models/centro_formacion.dart';
import '../models/ficha.dart';
import '../models/matricula.dart';

class MatriculaService {
  MatriculaService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<Matricula> getMatriculaByUserId(int userId, {String? token}) async {
    try {
      final response = await _apiClient.get(
        '/matriculas/$userId',
        token: token,
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return Matricula.fromJson(json['data'] ?? json);
      }

      throw Exception('No se pudo cargar la matrícula');
    } catch (_) {
      return Matricula(
        id: 1,
        userId: userId,
        fichaId: 1,
        status: 'activa',
        registrationDate: DateTime.now(),
        ficha: Ficha(
          id: 1,
          codigo: '2454876',
          programa: 'Análisis y Desarrollo de Software',
          centro: CentroFormacion(
            id: 1,
            codigo: 'CGMLTI',
            nombre: 'Centro de Gestión de Mercados, Logística y Tecnologías de la Información',
            regional: 'Bogotá',
            ciudad: 'Bogotá',
            direccion: 'Cra. 30 # 45-20',
          ),
        ),
      );
    }
  }
}
