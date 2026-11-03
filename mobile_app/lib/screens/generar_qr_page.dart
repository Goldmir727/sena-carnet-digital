import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../models/training_group.dart';
import '../services/qr_service.dart';

class QrAsistenciaPage extends StatefulWidget {
  final TrainingGroup group;
  final String activity;

  const QrAsistenciaPage({
    super.key,
    required this.group,
    required this.activity,
  });

  @override
  State<QrAsistenciaPage> createState() => _QrAsistenciaPageState();
}

class _QrAsistenciaPageState extends State<QrAsistenciaPage> {
  Timer? timer;

  int segundosRestantes = 300;

  bool asistenciaActiva = false;
  bool cargandoQr = true;
  bool cerrandoAsistencia = false;

  String? qrToken;
  int? sesionId;
  String? mensajeError;
  String? docente;
  final QrService _qrService = QrService();

  @override
  void initState() {
    super.initState();

    _generarQr();
  }

  Future<void> _generarQr() async {
    try {
      setState(() {
        cargandoQr = true;
        mensajeError = null;
      });

      final resultado = await _qrService.generateClassQr(
        groupId: widget.group.id,
        activity: widget.activity,
      );

      final tokenQr = resultado['qr_token'];

      if (tokenQr == null || tokenQr.toString().isEmpty) {
        throw Exception('No se pudo crear el código QR.');
      }

      if (!mounted) return;

      final expires = DateTime.tryParse(
        resultado['expires_at']?.toString() ?? '',
      )?.toLocal();
      final remaining = expires?.difference(DateTime.now()).inSeconds ?? 0;

      setState(() {
        qrToken = tokenQr.toString();
        sesionId = (resultado['sesion_id'] as num?)?.toInt();
        asistenciaActiva = remaining > 0;
        cargandoQr = false;
        docente = resultado['docente']?.toString();
        segundosRestantes = remaining > 0 ? remaining : 0;
      });

      if (segundosRestantes > 0) _iniciarTemporizador();
    } catch (_) {
      if (!mounted) return;

      setState(() {
        cargandoQr = false;
        asistenciaActiva = false;
        mensajeError = 'No fue posible crear la sesión. Revisa tu conexión e inténtalo de nuevo.';
      });
    }
  }

  void _iniciarTemporizador() {
    timer?.cancel();

    timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (segundosRestantes > 0) {
        if (mounted) {
          setState(() {
            segundosRestantes--;
          });
        }
      } else {
        _cerrarAsistencia();
      }
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  String get tiempoFormateado {
    final minutos = segundosRestantes ~/ 60;
    final segundos = segundosRestantes % 60;

    return '${minutos.toString().padLeft(2, '0')}:'
        '${segundos.toString().padLeft(2, '0')}';
  }

  void _cerrarAsistencia() {
    timer?.cancel();

    if (!mounted) return;

    setState(() {
      asistenciaActiva = false;
      segundosRestantes = 0;
    });
  }

  Future<void> _cerrarAsistenciaEnServidor() async {
    final id = sesionId;
    if (id == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudo encontrar la sesión de asistencia.'),
        ),
      );
      return;
    }

    setState(() => cerrandoAsistencia = true);
    try {
      await _qrService.closeClassSession(sessionId: id);
      if (mounted) _cerrarAsistencia();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'No se pudo cerrar la asistencia. Inténtalo de nuevo.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => cerrandoAsistencia = false);
    }
  }

  void _confirmarCierre() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text(
            'Cerrar asistencia',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          content: const Text(
            '¿Estás seguro de que deseas cerrar esta sesión de asistencia?',
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
              },
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: cerrandoAsistencia
                  ? null
                  : () {
                      Navigator.pop(context);
                      _cerrarAsistenciaEnServidor();
                    },
              child: cerrandoAsistencia
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Cerrar asistencia'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Código QR',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
      ),

      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              // =========================
              // ESTADO
              // =========================

              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  vertical: 12,
                  horizontal: 16,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: asistenciaActiva
                      ? const Color(0xFFE8F5EE)
                      : Colors.red.shade50,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      asistenciaActiva ? Icons.check_circle : Icons.cancel,
                      color: asistenciaActiva
                          ? const Color(0xFF0F7A4D)
                          : Colors.red,
                    ),

                    const SizedBox(width: 8),

                    Text(
                      cargandoQr
                          ? 'GENERANDO QR...'
                          : asistenciaActiva
                          ? 'ASISTENCIA ACTIVA'
                          : 'ASISTENCIA CERRADA',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: cargandoQr
                            ? const Color(0xFF0F7A4D)
                            : asistenciaActiva
                            ? const Color(0xFF0A5A39)
                            : Colors.red.shade700,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 25),

              const Text(
                'Escanea este código QR',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
              ),

              const SizedBox(height: 8),

              Text(
                asistenciaActiva
                    ? 'Los aprendices deben escanear el código para registrar su asistencia.'
                    : 'Esta sesión de asistencia ya finalizó.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 15,
                  color: Colors.grey,
                  height: 1.4,
                ),
              ),

              const SizedBox(height: 30),

              // =========================
              // QR
              // =========================
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF17212B).withValues(alpha: 0.12),
                      blurRadius: 12,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: cargandoQr
                    ? const SizedBox(
                        width: 260,
                        height: 260,
                        child: Center(child: CircularProgressIndicator()),
                      )
                    : qrToken != null
                    ? Opacity(
                        opacity: asistenciaActiva ? 1.0 : 0.25,
                        child: QrImageView(
                          data: qrToken!,
                          version: QrVersions.auto,
                          size: 260,
                          backgroundColor: Colors.white,
                        ),
                      )
                    : const SizedBox(
                        width: 260,
                        height: 260,
                        child: Center(
                          child: Icon(
                            Icons.error_outline,
                            size: 60,
                            color: Colors.red,
                          ),
                        ),
                      ),
              ),

              const SizedBox(height: 30),

              // =========================
              // ERROR
              // =========================
              if (mensajeError != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(15),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    mensajeError!,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.red.shade700),
                  ),
                ),

              const SizedBox(height: 15),

              // =========================
              // INFORMACIÓN
              // =========================
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(15),
                  color: Colors.grey.shade100,
                ),
                child: Column(
                  children: [
                    _dato(Icons.groups, 'Grupo', widget.group.name),

                    const Divider(height: 25),

                    _dato(Icons.school, 'Actividad', widget.activity),
                    if (docente != null) ...[
                      const Divider(height: 25),
                      _dato(Icons.person_outline, 'Docente', docente!),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 25),

              // =========================
              // TEMPORIZADOR
              // =========================
              if (asistenciaActiva)
                Column(
                  children: [
                    const Text(
                      'Tiempo restante',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),

                    const SizedBox(height: 5),

                    Text(
                      tiempoFormateado,
                      style: const TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),

              const SizedBox(height: 25),

              // =========================
              // BOTÓN CERRAR
              // =========================
              if (asistenciaActiva)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _confirmarCierre,
                    icon: const Icon(Icons.stop_circle),
                    label: const Text(
                      'Cerrar asistencia',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      backgroundColor: Colors.red,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),

              // =========================
              // VOLVER
              // =========================
              if (!asistenciaActiva && !cargandoQr)
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                    },
                    icon: const Icon(Icons.arrow_back),
                    label: const Text(
                      'Volver al instructor',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _dato(IconData icono, String titulo, String valor) {
    return Row(
      children: [
        Icon(icono, size: 28),

        const SizedBox(width: 15),

        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                titulo,
                style: const TextStyle(fontSize: 13, color: Colors.grey),
              ),

              const SizedBox(height: 3),

              Text(
                valor,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
