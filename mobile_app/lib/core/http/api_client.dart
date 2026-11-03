import 'dart:convert';

import 'package:http/http.dart' as http;

import '../constants/app_constants.dart';

class ApiClient {
  ApiClient();

  final String _baseUrl = AppConstants.apiBaseUrl;

  Future<http.Response> get(
    String path, {
    String? token,
    Map<String, String>? queryParameters,
  }) async {
    final uri = Uri.parse(_baseUrl + path).replace(
      queryParameters: queryParameters,
    );

    return http.get(
      uri,
      headers: _headers(token: token),
    );
  }

  Future<http.Response> post(
    String path,
    Map<String, dynamic> body, {
    String? token,
  }) async {
    return http.post(
      Uri.parse(_baseUrl + path),
      headers: _headers(token: token),
      body: jsonEncode(body),
    );
  }

  Future<http.Response> put(
    String path,
    Map<String, dynamic> body, {
    String? token,
  }) async {
    return http.put(
      Uri.parse(_baseUrl + path),
      headers: _headers(token: token),
      body: jsonEncode(body),
    );
  }

  Map<String, String> _headers({String? token}) {
    final headers = <String, String>{
      'Content-Type': 'application/json; charset=UTF-8',
      'Accept': 'application/json',
    };

    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    return headers;
  }
}
