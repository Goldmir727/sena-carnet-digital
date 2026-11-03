class CentroFormacion {
  final int id;
  final String codigo;
  final String nombre;
  final String regional;
  final String ciudad;
  final String? direccion;

  CentroFormacion({
    required this.id,
    required this.codigo,
    required this.nombre,
    required this.regional,
    required this.ciudad,
    this.direccion,
  });

  factory CentroFormacion.fromJson(Map<String, dynamic> json) {
    return CentroFormacion(
      id: json['id'],
      codigo: json['codigo'],
      nombre: json['nombre'],
      regional: json['regional'],
      ciudad: json['ciudad'],
      direccion: json['direccion'],
    );
  }
}