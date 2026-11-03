class CarnetDetails {
  const CarnetDetails({
    this.status,
    this.bloodType,
    this.regional,
    this.centerName,
    this.programName,
    this.groupNumber,
  });

  final String? status;
  final String? bloodType;
  final String? regional;
  final String? centerName;
  final String? programName;
  final String? groupNumber;

  factory CarnetDetails.fromJson(Map<String, dynamic> json) {
    return CarnetDetails(
      status: json['estado'] as String?,
      bloodType: json['tipo_sangre'] as String?,
      regional: json['regional'] as String?,
      centerName: json['centro_nombre'] as String?,
      programName: json['programa_nombre'] as String?,
      groupNumber: json['ficha_numero']?.toString(),
    );
  }
}