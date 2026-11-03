import 'app_constants.dart';

class ApiConstants {
  static final String baseUrl = AppConstants.apiBaseUrl;
  static final String login = '$baseUrl/auth/login';
  static final String verify2fa = '$baseUrl/auth/verify-2fa';
  static final String profile = '$baseUrl/users/me';

  static String profilePhotoUrl(int userId) => '$baseUrl/users/$userId/foto';
}