import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../providers/global_loading_provider.dart';
import '../services/attendance_service.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final MobileScannerController _scannerController = MobileScannerController();
  final TextEditingController _tokenController = TextEditingController();
  final AttendanceService _attendanceService = AttendanceService();

  bool _isScanning = true;
  bool _isSubmitting = false;
  AttendanceResult? _result;

  @override
  void dispose() {
    _scannerController.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  Future<void> _validateToken(String token) async {
    final cleanToken = token.trim();
    if (cleanToken.isEmpty || _isSubmitting) return;

    setState(() {
      _isSubmitting = true;
      _isScanning = false;
    });
    final loadingProvider = context.read<LoadingProvider>();
    loadingProvider.show('Validando asistencia');
    await _scannerController.stop();

    final result = await _attendanceService.validateQr(cleanToken);
    loadingProvider.hide();
    if (!mounted) return;

    setState(() {
      _isSubmitting = false;
      _result = result;
    });
  }

  Future<void> _startScanner() async {
    _tokenController.clear();
    setState(() {
      _result = null;
      _isScanning = true;
    });
    await _scannerController.start();
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;

    return Scaffold(
      appBar: widget.embedded
          ? null
          : AppBar(
              title: const Text('Control Asistencia'),
              backgroundColor: const Color(0xFF0A5A39),
              foregroundColor: Colors.white,
            ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Escanea el código QR de clase o evento',
            style: TextStyle(
              color: Color(0xFF17212B),
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),

          const SizedBox(height: 20),
          ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: SizedBox(
              height: 280,
              child: _isScanning
                  ? Stack(
                      fit: StackFit.expand,
                      children: [
                        MobileScanner(
                          controller: _scannerController,
                          onDetect: (capture) {
                            final code = capture.barcodes
                                .map((barcode) => barcode.rawValue)
                                .whereType<String>()
                                .firstWhere(
                                  (value) => value.trim().isNotEmpty,
                                  orElse: () => '',
                                );
                            if (code.isNotEmpty) {
                              _validateToken(code);
                            }
                          },
                        ),
                        IgnorePointer(
                          child: Center(
                            child: Container(
                              width: 210,
                              height: 210,
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: const Color(0xFF0F7A4D),
                                  width: 3,
                                ),
                                borderRadius: BorderRadius.circular(18),
                              ),
                            ),
                          ),
                        ),
                      ],
                    )
                  : Container(
                      color: const Color(0xFFF3F6F4),
                      alignment: Alignment.center,
                      child: _isSubmitting
                          ? const CircularProgressIndicator(
                              color: Color(0xFF0F7A4D),
                            )
                          : const Icon(
                              Icons.qr_code_2,
                              size: 100,
                              color: Color(0xFF17212B),
                            ),
                    ),
            ),
          ),
          const SizedBox(height: 16),
          if (result != null) _ResultBanner(result: result),
          if (result != null) const SizedBox(height: 16),
          TextField(
            controller: _tokenController,
            decoration: InputDecoration(
              labelText: 'Ingresar código manualmente',
              hintText: 'Escribe aquí el código si no puedes escanearlo',
              prefixIcon: const Icon(Icons.key_outlined),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onSubmitted: _validateToken,
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _isSubmitting
                ? null
                : () => _validateToken(_tokenController.text),
            icon: const Icon(Icons.cloud_done_outlined),
            label: const Text('Validar asistencia'),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF0F7A4D),
              minimumSize: const Size.fromHeight(50),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _isSubmitting ? null : _startScanner,
            icon: const Icon(Icons.refresh),
            label: const Text('Escanear otro código'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(50),
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultBanner extends StatelessWidget {
  const _ResultBanner({required this.result});

  final AttendanceResult result;

  @override
  Widget build(BuildContext context) {
    final color = result.success
        ? const Color(0xFF0F7A4D)
        : Colors.red.shade700;
    final icon = result.success ? Icons.check_circle : Icons.error_outline;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.35)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              result.message,
              style: TextStyle(color: color, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
