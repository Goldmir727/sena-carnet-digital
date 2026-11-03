class AccessRecord {
  const AccessRecord({
    required this.id,
    required this.movement,
    required this.day,
    required this.time,
    required this.center,
    required this.timestamp,
  });

  final int id;
  final String movement;
  final String day;
  final String time;
  final String center;
  final DateTime? timestamp;

  factory AccessRecord.fromJson(Map<String, dynamic> json) {
    return AccessRecord(
      id: json['id'] as int? ?? 0,
      movement: json['movement'] as String? ?? 'Entrada',
      day: json['day'] as String? ?? '',
      time: json['time'] as String? ?? '',
      center: json['center'] as String? ?? 'Centro SENA',
      timestamp: DateTime.tryParse(json['timestamp'] as String? ?? ''),
    );
  }
}