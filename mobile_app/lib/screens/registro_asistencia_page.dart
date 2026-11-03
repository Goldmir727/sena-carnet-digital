import 'package:flutter/material.dart';

import '../services/attendance_service.dart';

class RegistrosAsistenciaPage extends StatefulWidget {
  final int grupoId;

  const RegistrosAsistenciaPage({super.key, required this.grupoId});

  @override
  State<RegistrosAsistenciaPage> createState() =>
      _RegistrosAsistenciaPageState();
}

class _RegistrosAsistenciaPageState extends State<RegistrosAsistenciaPage> {
  List<Map<String, dynamic>> asistencias = [];

  int totalAprendices = 0;
  int presentesHoy = 0;
  int ausentesHoy = 0;

  bool cargando = true;
  String? error;

  DateTime? fechaSeleccionada;
  final AttendanceService _attendanceService = AttendanceService();

  @override
  void initState() {
    super.initState();
    cargarDatos();
  }

  Future<void> cargarDatos() async {
    if (!mounted) return;

    setState(() {
      cargando = true;
      error = null;
    });

    try {
      final fecha = fechaSeleccionada == null
          ? null
          : '${fechaSeleccionada!.year.toString().padLeft(4, '0')}-'
                '${fechaSeleccionada!.month.toString().padLeft(2, '0')}-'
                '${fechaSeleccionada!.day.toString().padLeft(2, '0')}';

      final resultados = await Future.wait<dynamic>([
        _attendanceService.getGroupRecords(
          groupId: widget.grupoId,
          date: fecha,
        ),
        _attendanceService.getGroupStats(groupId: widget.grupoId),
      ]);

      final lista = resultados[0] as List<dynamic>;
      final stats = resultados[1] as Map<String, dynamic>;

      if (!mounted) return;

      setState(() {
        asistencias = lista
            .map((item) => Map<String, dynamic>.from(item))
            .toList();

        totalAprendices = _toInt(stats['total']);
        presentesHoy = _toInt(stats['presentes_hoy']);
        ausentesHoy = _toInt(stats['ausentes']);

        cargando = false;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        cargando = false;
        error = 'Revisa tu conexión e inténtalo de nuevo.';
      });
    }
  }

  int _toInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '0') ?? 0;
  }

  Future<void> seleccionarFecha() async {
    final fecha = await showDatePicker(
      context: context,
      initialDate: fechaSeleccionada ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(primary: Color(0xFF0F7A4D)),
          ),
          child: child!,
        );
      },
    );

    if (fecha != null) {
      setState(() {
        fechaSeleccionada = fecha;
      });
      await cargarDatos();
    }
  }

  void limpiarFiltro() {
    setState(() {
      fechaSeleccionada = null;
    });

    cargarDatos();
  }

  String formatearFecha(dynamic valor) {
    if (valor == null) return 'Sin fecha';

    try {
      final fecha = DateTime.parse(valor.toString()).toLocal();

      return '${fecha.day.toString().padLeft(2, '0')}/'
          '${fecha.month.toString().padLeft(2, '0')}/'
          '${fecha.year}';
    } catch (_) {
      return valor.toString();
    }
  }

  String formatearHora(dynamic valor) {
    if (valor == null) return '--:--';

    try {
      final fecha = DateTime.parse(valor.toString()).toLocal();

      return '${fecha.hour.toString().padLeft(2, '0')}:'
          '${fecha.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '--:--';
    }
  }

  String nombreAprendiz(Map<String, dynamic> asistencia) {
    final nombre = asistencia['name']?.toString() ?? '';
    final apellido = asistencia['last_name']?.toString() ?? '';

    final completo = '$nombre $apellido'.trim();

    if (completo.isEmpty) {
      return 'Aprendiz sin nombre';
    }

    return completo;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F6F4),

      appBar: AppBar(
        backgroundColor: const Color(0xFF0A5A39),
        elevation: 0,
        title: const Text(
          'Registros de asistencia',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),

      body: RefreshIndicator(
        onRefresh: cargarDatos,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Asistencias',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF17212B),
                ),
              ),

              const SizedBox(height: 6),

              const Text(
                'Consulta qué aprendices registraron su asistencia y cuándo.',
                style: TextStyle(fontSize: 15, color: Color(0xFF44525F)),
              ),

              const SizedBox(height: 24),

              // =========================
              // ESTADÍSTICAS
              // =========================
              LayoutBuilder(
                builder: (context, constraints) {
                  final ancho = constraints.maxWidth;

                  if (ancho < 600) {
                    return Column(
                      children: [
                        _tarjetaEstadistica(
                          'Total',
                          totalAprendices.toString(),
                          Icons.groups,
                        ),
                        const SizedBox(height: 12),
                        _tarjetaEstadistica(
                          'Presentes hoy',
                          presentesHoy.toString(),
                          Icons.check_circle,
                        ),
                        const SizedBox(height: 12),
                        _tarjetaEstadistica(
                          'Ausentes',
                          ausentesHoy.toString(),
                          Icons.cancel,
                        ),
                      ],
                    );
                  }

                  return Row(
                    children: [
                      Expanded(
                        child: _tarjetaEstadistica(
                          'Total',
                          totalAprendices.toString(),
                          Icons.groups,
                        ),
                      ),
                      const SizedBox(width: 15),
                      Expanded(
                        child: _tarjetaEstadistica(
                          'Presentes hoy',
                          presentesHoy.toString(),
                          Icons.check_circle,
                        ),
                      ),
                      const SizedBox(width: 15),
                      Expanded(
                        child: _tarjetaEstadistica(
                          'Ausentes',
                          ausentesHoy.toString(),
                          Icons.cancel,
                        ),
                      ),
                    ],
                  );
                },
              ),

              const SizedBox(height: 25),

              // =========================
              // FILTRO POR FECHA
              // =========================
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF17212B).withValues(alpha: 0.05),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Filtros',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF17212B),
                      ),
                    ),

                    const SizedBox(height: 15),

                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: seleccionarFecha,
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 14,
                              ),
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: const Color(0xFFCDE8DA),
                                ),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.calendar_today,
                                    size: 20,
                                    color: Color(0xFF17212B),
                                  ),

                                  const SizedBox(width: 10),

                                  Expanded(
                                    child: Text(
                                      fechaSeleccionada == null
                                          ? 'Seleccionar fecha'
                                          : '${fechaSeleccionada!.day.toString().padLeft(2, '0')}/'
                                                '${fechaSeleccionada!.month.toString().padLeft(2, '0')}/'
                                                '${fechaSeleccionada!.year}',
                                      style: TextStyle(
                                        fontSize: 15,
                                        color: fechaSeleccionada == null
                                            ? const Color(0xFF44525F)
                                            : const Color(0xFF17212B),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(width: 10),

                        ElevatedButton(
                          onPressed: cargarDatos,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0A5A39),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 15,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: const Text(
                            'Aplicar',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),

                        if (fechaSeleccionada != null) ...[
                          const SizedBox(width: 8),

                          IconButton(
                            onPressed: limpiarFiltro,
                            tooltip: 'Limpiar filtro',
                            icon: const Icon(
                              Icons.clear,
                              color: Color(0xFF44525F),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 25),

              // =========================
              // TÍTULO REGISTROS
              // =========================
              const Text(
                'Aprendices que registraron asistencia',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF17212B),
                ),
              ),

              const SizedBox(height: 12),

              // =========================
              // CARGANDO
              // =========================
              if (cargando)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 50),
                  child: Center(
                    child: CircularProgressIndicator(color: Color(0xFF17212B)),
                  ),
                )
              // =========================
              // ERROR
              // =========================
              else if (error != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    children: [
                      const Icon(
                        Icons.error_outline,
                        size: 45,
                        color: Colors.red,
                      ),

                      const SizedBox(height: 10),

                      const Text(
                        'No se pudieron cargar las asistencias.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF17212B),
                        ),
                      ),

                      const SizedBox(height: 8),

                      Text(
                        error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF44525F),
                        ),
                      ),

                      const SizedBox(height: 15),

                      OutlinedButton.icon(
                        onPressed: cargarDatos,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              // =========================
              // SIN REGISTROS
              // =========================
              else if (asistencias.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    vertical: 45,
                    horizontal: 20,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Column(
                    children: [
                      Icon(
                        Icons.assignment_outlined,
                        size: 50,
                        color: Color(0xFF44525F),
                      ),

                      SizedBox(height: 12),

                      Text(
                        'Aún no hay aprendices con asistencia registrada.',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF17212B),
                        ),
                      ),

                      SizedBox(height: 5),

                      Text(
                        'Cuando un aprendiz registre su asistencia, aparecerá aquí.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF44525F),
                        ),
                      ),
                    ],
                  ),
                )
              // =========================
              // LISTA DE ASISTENCIAS
              // =========================
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: asistencias.length,
                  itemBuilder: (context, index) {
                    final asistencia = asistencias[index];

                    final documento =
                        asistencia['document']?.toString() ?? 'Sin documento';

                    final fechaHora = asistencia['fecha_hora'];

                    return Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF17212B)
                                .withValues(alpha: 0.04),
                            blurRadius: 7,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Avatar
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3F6F4),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.person,
                              color: Color(0xFF17212B),
                            ),
                          ),

                          const SizedBox(width: 14),

                          // Información
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  nombreAprendiz(asistencia),
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF17212B),
                                  ),
                                ),

                                const SizedBox(height: 5),

                                Text(
                                  'Documento: $documento',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: Color(0xFF44525F),
                                  ),
                                ),

                                const SizedBox(height: 8),

                                Row(
                                  children: [
                                    const Icon(
                                      Icons.calendar_today,
                                      size: 15,
                                      color: Color(0xFF44525F),
                                    ),

                                    const SizedBox(width: 5),

                                    Text(
                                      formatearFecha(fechaHora),
                                      style: const TextStyle(
                                        fontSize: 13,
                                        color: Color(0xFF44525F),
                                      ),
                                    ),

                                    const SizedBox(width: 15),

                                    const Icon(
                                      Icons.access_time,
                                      size: 15,
                                      color: Color(0xFF44525F),
                                    ),

                                    const SizedBox(width: 5),

                                    Text(
                                      formatearHora(fechaHora),
                                      style: const TextStyle(
                                        fontSize: 13,
                                        color: Color(0xFF44525F),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),

                          // Estado
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE8F5EE),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Text(
                              'Presente',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF0A5A39),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tarjetaEstadistica(String titulo, String valor, IconData icono) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF17212B).withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 45,
            height: 45,
            decoration: BoxDecoration(
              color: const Color(0xFFF3F6F4),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icono, color: const Color(0xFF17212B)),
          ),

          const SizedBox(width: 13),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  titulo,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF44525F),
                  ),
                ),

                const SizedBox(height: 3),

                Text(
                  valor,
                  style: const TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF17212B),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
