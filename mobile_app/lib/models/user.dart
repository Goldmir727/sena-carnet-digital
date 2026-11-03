class User {
  final int id;
  final String firstName;
  final String lastName;
  final String email;
  final String role;
  final String documentType;
  final String documentNumber;
  final String sex;
  final String bloodType;
  final String? photoProfile;
  final bool isActive;

  User({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.role,
    this.documentType = '',
    this.documentNumber = '',
    this.sex = '',
    this.bloodType = '',
    this.photoProfile,
    this.isActive = true,
  });

  // Getter para obtener el nombre completo
  String get fullName => '$firstName $lastName'.trim();

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? 0,
      firstName:
          json['first_name'] ?? json['firstName'] ?? json['nombres'] ?? '',
      lastName:
          json['last_name'] ?? json['lastName'] ?? json['apellidos'] ?? '',
      email: json['email'] ?? '',
      role: _roleName(json['role'] ?? json['role_name'], json['role_id']),
      documentType: json['document_type'] ?? json['tipo_documento'] ?? '',
      documentNumber: json['document'] ?? json['numero_documento'] ?? '',
      sex: json['sex'] ?? json['sexo'] ?? '',
      bloodType: json['blood_type'] ?? json['tipo_sangre'] ?? '',
      photoProfile: json['photo_profile'] ?? json['foto_perfil'],
      isActive: json['is_active'] ?? true,
    );
  }

  static String _roleName(dynamic role, dynamic roleId) {
    if (role is String && role.isNotEmpty) return role;
    switch (roleId) {
      case 1:
        return 'Coordinador';
      case 2:
        return 'Docente';
      case 3:
        return 'Aprendiz';
      case 4:
        return 'Funcionario';
      case 5:
        return 'Validador';
      default:
        return 'Aprendiz';
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'first_name': firstName,
      'last_name': lastName,
      'email': email,
      'role': role,
      'document_type': documentType,
      'document': documentNumber,
      'sex': sex,
      'blood_type': bloodType,
      'photo_profile': photoProfile,
      'is_active': isActive,
    };
  }
}
