class TrainingGroup {
  const TrainingGroup({
    required this.id,
    required this.name,
    this.description,
    this.createdAt,
  });

  final int id;
  final String name;
  final String? description;
  final DateTime? createdAt;

  factory TrainingGroup.fromJson(Map<String, dynamic> json) {
    return TrainingGroup(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['nombre'] as String? ?? '',
      description: json['descripcion'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? ''),
    );
  }
}
