import 'package:flutter/material.dart';
import 'package:cross_file/cross_file.dart';

import '../models/user.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();

  User? user;
  bool isLoading = false;
  String? errorMessage;
  String? pendingPreauthToken;
  bool twoFactorVerified = false;

  // Verificar si hay sesión activa al iniciar la app
  Future<void> checkAuthStatus() async {
    isLoading = true;
    notifyListeners();

    final isAuth = await _authService.isAuthenticated();
    if (isAuth) {
      user = await _authService.getUserProfile();
    } else {
      user = null;
    }

    isLoading = false;
    notifyListeners();
  }

  // Método de Iniciar Sesión
  Future<bool> login(String email, String password) async {
    isLoading = true;
    errorMessage = null;
    twoFactorVerified = false;
    notifyListeners();

    final result = await _authService.login(email, password);

    if (result['success'] == true) {
      if (result['user'] != null) {
        user = result['user'];
      } else {
        user = await _authService.getUserProfile();
      }
      isLoading = false;
      notifyListeners();
      return true;
    } else {
      pendingPreauthToken = result['preauth_token'] as String?;
      twoFactorVerified = false;
      if (result['requires_2fa'] == true && pendingPreauthToken != null) {
        errorMessage = 'Se requiere el código de verificación.';
      } else {
        errorMessage = result['message'] ?? 'No se pudo iniciar sesión. Verifica tus datos e inténtalo de nuevo.';
      }
      isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> verifyTwoFactor(String code) async {
    final preauthToken = pendingPreauthToken;
    if (preauthToken == null) return false;

    isLoading = true;
    errorMessage = null;
    notifyListeners();

    final result = await _authService.verifyTwoFactor(
      preauthToken: preauthToken,
      code: code,
    );

    if (result['success'] == true) {
      pendingPreauthToken = null;
      twoFactorVerified = true;
      user = await _authService.getUserProfile();
      if (user == null) {
        errorMessage = 'El código fue validado, pero no se pudo cargar el perfil. Reintenta.';
      }
      isLoading = false;
      notifyListeners();
      return user != null;
    }

    errorMessage = result['message'] ?? 'Código de verificación inválido.';
    isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> retryAuthenticatedProfile() async {
    if (!twoFactorVerified) return false;

    isLoading = true;
    errorMessage = null;
    notifyListeners();
    user = await _authService.getUserProfile();
    if (user == null) {
      errorMessage =
          'El código ya fue validado, pero el perfil sigue sin responder.';
    } else {
      twoFactorVerified = false;
    }
    isLoading = false;
    notifyListeners();
    return user != null;
  }

  // Cerrar Sesión
  Future<void> logout() async {
    await _authService.logout();
    user = null;
    pendingPreauthToken = null;
    twoFactorVerified = false;
    notifyListeners();
  }

  Future<bool> updateProfile(Map<String, dynamic> changes) async {
    if (user == null) return false;

    isLoading = true;
    errorMessage = null;
    notifyListeners();

    final result = await _authService.updateProfile(
      userId: user!.id,
      changes: changes,
    );

    if (result['success'] == true) {
      user = result['user'] as User;
      isLoading = false;
      notifyListeners();
      return true;
    }

    errorMessage =
        result['message'] as String? ?? 'No se pudo actualizar el perfil.';
    isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> updateProfilePhoto(XFile image) async {
    if (user == null) return false;

    isLoading = true;
    errorMessage = null;
    notifyListeners();
    final result = await _authService.uploadProfilePhoto(
      userId: user!.id,
      image: image,
    );

    if (result['success'] == true && result['user'] is User) {
      user = result['user'] as User;
      isLoading = false;
      notifyListeners();
      return true;
    }

    errorMessage =
        result['message'] as String? ?? 'No se pudo cargar la fotografía.';
    isLoading = false;
    notifyListeners();
    return false;
  }

  Future<Map<String, dynamic>> requestPasswordReset(String email) {
    return _authService.requestPasswordReset(email);
  }

  Future<Map<String, dynamic>> resetPassword({
    required String token,
    required String newPassword,
  }) {
    return _authService.resetPassword(token: token, newPassword: newPassword);
  }
}
