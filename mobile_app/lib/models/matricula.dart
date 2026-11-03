import 'ficha.dart';

class Matricula {
  final int id;
  final int userId;
  final int fichaId;
  final String status;
  final DateTime registrationDate;
  final Ficha? ficha;

  Matricula({
    required this.id,
    required this.userId,
    required this.fichaId,
    required this.status,
    required this.registrationDate,
    this.ficha,
  });

  factory Matricula.fromJson(Map<String, dynamic> json) {
    return Matricula(
      id: json['id'],
      userId: json['user_id'],
      fichaId: json['ficha_id'],
      status: json['status'],
      registrationDate: DateTime.parse(json['registration_date']),
      ficha: json['ficha'] != null ? Ficha.fromJson(json['ficha']) : null,
    );
  }
}