import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:cross_file/cross_file.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants/api_constants.dart';
import '../models/user.dart';

class AuthService {
  static const String _tokenKey = 'auth_token';

  // 1. Verificar si hay token guardado
  Future<bool> isAuthenticated() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    return token != null && token.isNotEmpty;
  }

  // 2. Obtener el token guardado
  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  // 3. Método de Login
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse(ApiConstants.login),
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: {'username': email, 'password': password},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        return {
          'success': false,
          'requires_2fa': data['requires_2fa'] == true,
          'preauth_token': data['preauth_token'],
          'message': data['message'] ?? 'Ingresa el código de verificación.',
        };
      } else {
        final errorData = jsonDecode(response.body);
        return {
          'success': false,
          'message': errorData['detail'] ?? 'Credenciales incorrectas',
        };
      }
    } catch (_) {
      return {
        'success': false,
        'message':
            'No pudimos comunicarnos. Revisa tu conexión e inténtalo de nuevo.',
      };
    }
  }

  Future<Map<String, dynamic>> verifyTwoFactor({
    required String preauthToken,
    required String code,
  }) async {
    try {
      final response = await http.post(
        Uri.parse(ApiConstants.verify2fa),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'preauth_token': preauthToken, 'code': code}),
      );

      final data = response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>
          : <String, dynamic>{};
      if (response.statusCode == 200 && data['access_token'] is String) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tokenKey, data['access_token'] as String);
        return {'success': true};
      }

      return {
        'success': false,
        'message':
            data['detail'] ?? 'El código no es válido. Inténtalo de nuevo.',
      };
    } catch (_) {
      return {
        'success': false,
        'message':
            'No pudimos comunicarnos. Revisa tu conexión e inténtalo de nuevo.',
      };
    }
  }

  // 4. Obtener el perfil del usuario autenticado
  Future<User?> getUserProfile() async {
    try {
      final token = await getToken();
      if (token == null) return null;

      final response = await http.get(
        Uri.parse(ApiConstants.profile),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return User.fromJson(data);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, dynamic>> updateProfile({
    required int userId,
    required Map<String, dynamic> changes,
  }) async {
    try {
      final token = await getToken();
      if (token == null || token.isEmpty) {
        return {'success': false, 'message': 'La sesión ha expirado.'};
      }

      final response = await http.put(
        Uri.parse('${ApiConstants.baseUrl}/users/$userId'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(changes),
      );
      final data = response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>
          : <String, dynamic>{};

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {'success': true, 'user': User.fromJson(data)};
      }

      return {
        'success': false,
        'message': data['detail'] ?? 'No se pudo actualizar el perfil.',
      };
    } catch (_) {
      return {
        'success': false,
        'message':
            'No pudimos comunicarnos. Revisa tu conexión e inténtalo de nuevo.',
      };
    }
  }

  Future<Map<String, dynamic>> uploadProfilePhoto({
    required int userId,
    required XFile image,
  }) async {
    try {
      final token = await getToken();
      if (token == null || token.isEmpty) {
        return {'success': false, 'message': 'La sesión ha expirado.'};
      }

      final request =
          http.MultipartRequest(
              'POST',
              Uri.parse('${ApiConstants.baseUrl}/users/$userId/foto'),
            )
            ..headers['Authorization'] = 'Bearer $token'
            ..files.add(
              http.MultipartFile.fromBytes(
                'file',
                await image.readAsBytes(),
                filename: image.name,
              ),
            );
      final response = await request.send();
      final body = await response.stream.bytesToString();
      final data = body.isNotEmpty
          ? jsonDecode(body) as Map<String, dynamic>
          : <String, dynamic>{};

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final refreshedUser = await getUserProfile();
        return {'success': true, 'user': refreshedUser ?? User.fromJson(data)};
      }
      return {
        'success': false,
        'message': data['detail'] ?? 'No se pudo cargar la fotografía.',
      };
    } catch (_) {
      return {'success': false, 'message': 'No se pudo cargar la fotografía.'};
    }
  }

  Future<Map<String, dynamic>> requestPasswordReset(String email) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConstants.baseUrl}/auth/forgot-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email}),
      );
      final data = response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>
          : <String, dynamic>{};

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {'success': true, 'message': data['message']};
      }
      return {
        'success': false,
        'message': data['detail'] ?? 'No se pudieron enviar las instrucciones.',
      };
    } catch (_) {
      return {
        'success': false,
        'message':
            'No pudimos comunicarnos. Revisa tu conexión e inténtalo de nuevo.',
      };
    }
  }

  Future<Map<String, dynamic>> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConstants.baseUrl}/auth/reset-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'token': token, 'new_password': newPassword}),
      );
      final data = response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>
          : <String, dynamic>{};

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {'success': true, 'message': data['message']};
      }
      return {
        'success': false,
        'message': data['detail'] ?? 'No se pudo cambiar la contraseña.',
      };
    } catch (_) {
      return {
        'success': false,
        'message':
            'No pudimos comunicarnos. Revisa tu conexión e inténtalo de nuevo.',
      };
    }
  }

  // 5. Cerrar Sesión
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }
}
