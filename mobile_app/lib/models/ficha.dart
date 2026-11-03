import 'centro_formacion.dart';

class Ficha {
  final int id;
  final String codigo;
  final String programa;
  final CentroFormacion? centro;

  Ficha({
    required this.id,
    required this.codigo,
    required this.programa,
    this.centro,
  });

  factory Ficha.fromJson(Map<String, dynamic> json) {
    return Ficha(
      id: json['id'],
      codigo: json['codigo'],
      programa: json['programa'],
      centro: json['centro'] != null
          ? CentroFormacion.fromJson(json['centro'])
          : null,
    );
  }
}