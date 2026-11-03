import 'package:flutter/material.dart';

class LoadingProvider extends ChangeNotifier {
  bool _isLoading = false;
  String _message = 'Cargando...';

  bool get isLoading => _isLoading;
  String get message => _message;

  void show([String message = 'Cargando...']) {
    _isLoading = true;
    _message = message;
    notifyListeners();
  }

  void hide() {
    _isLoading = false;
    notifyListeners();
  }
}
