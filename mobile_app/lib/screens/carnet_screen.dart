import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../models/carnet_details.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../services/carnet_service.dart';
import '../services/qr_service.dart';
import '../widgets/authenticated_profile_photo.dart';
import '../widgets/sena_loading.dart';

class CarnetScreen extends StatefulWidget {
  const CarnetScreen({super.key});

  @override
  State<CarnetScreen> createState() => _CarnetScreenState();
}

class _CarnetScreenState extends State<CarnetScreen>
    with SingleTickerProviderStateMixin {
  bool _showBack = false;
  bool _targetBack = false;
  final QrService _qrService = QrService();
  final CarnetService _carnetService = CarnetService();
  CarnetQr? _carnetQr;
  CarnetDetails? _carnetDetails;
  bool _qrLoading = true;
  bool _detailsLoading = true;
  bool _noCarnetAssigned = false;
  bool _carnetLoadFailed = false;
  bool _showQrLoader = false;
  String? _qrError;
  late final AnimationController _flipController;

  @override
  void initState() {
    super.initState();
    _flipController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 850),
    )..addListener(_updateVisibleFace);
    _loadCarnetData();
  }

  Future<void> _loadCarnetData() async {
    setState(() {
      _qrLoading = true;
      _detailsLoading = true;
      _noCarnetAssigned = false;
      _carnetLoadFailed = false;
      _showQrLoader = false;
      _qrError = null;
    });

    Timer(const Duration(milliseconds: 300), () {
      if (mounted && _qrLoading) {
        setState(() => _showQrLoader = true);
      }
    });

    try {
      final details = await _carnetService.getMine();
      if (!mounted) return;
      setState(() {
        _carnetDetails = details;
        _detailsLoading = false;
      });

      if (details.status?.toLowerCase() != 'activo') {
        if (!mounted) return;
        setState(() {
          _qrLoading = false;
          _showQrLoader = false;
          _qrError = 'El carnet no está activo y no tiene un QR disponible.';
        });
        return;
      }

      final qr = await _qrService.generateCarnetQr();
      if (!mounted) return;
      setState(() {
        _carnetQr = qr;
        _qrLoading = false;
        _showQrLoader = false;
      });
    } on CarnetNotAssignedException {
      if (!mounted) return;
      setState(() {
        _detailsLoading = false;
        _qrLoading = false;
        _showQrLoader = false;
        _noCarnetAssigned = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _detailsLoading = false;
        _qrLoading = false;
        _showQrLoader = false;
        _carnetLoadFailed = true;
      });
    }
  }

  void _updateVisibleFace() {
    final crossedHalfway = _flipController.value >= 0.5;
    if (crossedHalfway != _showBack) {
      setState(() => _showBack = crossedHalfway);
    }
  }

  @override
  void dispose() {
    _flipController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final user = authProvider.user;

    final String fullName = user?.fullName ?? 'No registrado';
    final String documentNumber = user?.documentNumber.isNotEmpty == true
        ? user!.documentNumber
        : 'No registrado';
    final details = _carnetDetails;
    final rh = details?.bloodType ?? 'No registrado';
    final regional = details?.regional ?? 'No registrado';
    final centerName = details?.centerName ?? 'No registrado';
    final program = details?.programName ?? 'No registrado';
    final groupNumber = details?.groupNumber ?? 'No registrado';

    if (_noCarnetAssigned) {
      return _CarnetEmptyState(
        icon: Icons.badge_outlined,
        title: 'No tienes un carnet asignado',
        message: 'Aunque tengas una matrícula activa, coordinación debe emitir tu carnet para que aparezca aquí.',
        actionLabel: 'Actualizar',
        onAction: _loadCarnetData,
      );
    }

    if (_carnetLoadFailed) {
      return _CarnetEmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'No se pudo cargar el carnet',
        message: 'Revisa tu conexión e inténtalo nuevamente.',
        actionLabel: 'Reintentar',
        onAction: _loadCarnetData,
      );
    }

    return SenaLoadingOverlay(
      visible: _showQrLoader,
      message: 'Generando QR seguro',
      child: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(20.0),
        child: Center(
          child: GestureDetector(
            onTap: () {
              _targetBack = !_targetBack;
              if (_targetBack) {
                _flipController.forward();
              } else {
                _flipController.reverse();
              }
            },
            child: AnimatedBuilder(
              animation: _flipController,
              builder: (context, child) {
                final transform = Matrix4.identity()
                  ..setEntry(3, 2, 0.0015)
                  ..rotateY(_flipController.value * 3.141592653589793);
                return Transform(
                  alignment: Alignment.center,
                  transform: transform,
                  child: child,
                );
              },
              child: Container(
                width: double.infinity,
                height: 570,
                constraints: const BoxConstraints(maxWidth: 400),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF17212B).withValues(alpha: 0.12),
                      blurRadius: 15,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: _showBack
                    ? Transform(
                        alignment: Alignment.center,
                        transform: Matrix4.identity()
                          ..rotateY(3.141592653589793),
                        child: _buildBack(fullName: fullName),
                      )
                    : SizedBox(
                        height: 570,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              // 1. CABECERA INSTITUCIONAL
                              Container(
                                color: const Color(0xFF17212B),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 20,
                                  vertical: 16,
                                ),
                                child: Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: const [
                                        Text(
                                          'SENA',
                                          style: TextStyle(
                                            color: Color(
                                              0xFF0F7A4D,
                                            ), // Verde SENA
                                            fontSize: 22,
                                            fontWeight: FontWeight.bold,
                                            letterSpacing: 1.2,
                                          ),
                                        ),
                                        Text(
                                          'CARNET DIGITAL',
                                          style: TextStyle(
                                            color: Colors.white70,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w600,
                                            letterSpacing: 1,
                                          ),
                                        ),
                                      ],
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF0F7A4D),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        (user?.role.isNotEmpty == true
                                                ? user!.role
                                                : 'Aprendiz')
                                            .toUpperCase(),
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              const SizedBox(height: 20),

                              // 2. FOTO Y DATOS PERSONALES PRINCIPALES
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 20,
                                ),
                                child: Column(
                                  children: [
                                    // Avatar o foto de perfil
                                    _CarnetPhoto(user: user),
                                    const SizedBox(height: 8),

                                    // Nombre
                                    Text(
                                      fullName,
                                      style: const TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF17212B),
                                      ),
                                    ),
                                    const SizedBox(height: 10),

                                    // Cédula / CC y RH
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 6,
                                          ),
                                          decoration: BoxDecoration(
                                            color: Colors.grey.shade100,
                                            borderRadius: BorderRadius.circular(
                                              8,
                                            ),
                                            border: Border.all(
                                              color: Colors.grey.shade300,
                                            ),
                                          ),
                                          child: Text(
                                            'CC: $documentNumber',
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600,
                                              color: Color(0xFF17212B),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 6,
                                          ),
                                          decoration: BoxDecoration(
                                            color: Colors.red.shade50,
                                            borderRadius: BorderRadius.circular(
                                              8,
                                            ),
                                            border: Border.all(
                                              color: Colors.red.shade200,
                                            ),
                                          ),
                                          child: Text(
                                            'RH: $rh',
                                            style: TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.red.shade700,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),

                              const SizedBox(height: 44),

                              // 3. SECCIÓN INFERIOR: REGIONAL, CENTRO, PROGRAMA Y FICHA
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.fromLTRB(
                                  18,
                                  12,
                                  18,
                                  18,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF3F6F4),
                                  border: Border(
                                    top: BorderSide(
                                      color: Colors.grey.shade300,
                                      width: 1,
                                    ),
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Regional y Centro
                                    _buildInfoRow(
                                      icon: Icons.location_city_rounded,
                                      title: 'Regional: $regional',
                                      subtitle: centerName,
                                    ),
                                    const Divider(height: 12, thickness: 0.8),

                                    // Programa / Tecnólogo
                                    _buildInfoRow(
                                      icon: Icons.school_rounded,
                                      title: 'Programa de Formación',
                                      subtitle: program,
                                    ),
                                    const Divider(height: 12, thickness: 0.8),

                                    // Número de Ficha
                                    _buildInfoRow(
                                      icon: Icons.subtitles_rounded,
                                      title: 'Número de Ficha',
                                      subtitle: groupNumber,
                                      highlightSubtitle: true,
                                    ),
                                    if (!_detailsLoading &&
                                        details?.status?.toLowerCase() !=
                                            'activo')
                                      const Padding(
                                        padding: EdgeInsets.only(top: 12),
                                        child: Text(
                                          'No tienes un carnet activo asignado.',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            color: Colors.redAccent,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBack({required String fullName}) {
    return ClipRRect(
      key: const ValueKey('carnet-back'),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 570,
        color: const Color(0xFFF3F6F4),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'VALIDACIÓN DEL CARNET',
              style: TextStyle(
                color: Color(0xFF17212B),
                fontSize: 15,
                fontWeight: FontWeight.bold,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              fullName,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF17212B),
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 22),
            _buildQrContent(),
            const SizedBox(height: 18),
            const Text(
              'Toca el carnet para volver a la información',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQrContent() {
    if (_qrLoading) {
      return const SizedBox(
        height: 220,
        child: Center(
          child: CircularProgressIndicator(color: Color(0xFF0F7A4D)),
        ),
      );
    }

    if (_carnetQr == null) {
      return SizedBox(
        height: 220,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off_outlined, color: Colors.red, size: 42),
            const SizedBox(height: 8),
            Text(
              _qrError ?? 'No se pudo obtener el carnet.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.red.shade700, fontSize: 12),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _loadCarnetData,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
            ),
          ],
        ),
      );
    }

    return QrImageView(
      data: _carnetQr!.token,
      version: QrVersions.auto,
      size: 220,
      backgroundColor: Colors.white,
      eyeStyle: const QrEyeStyle(
        eyeShape: QrEyeShape.square,
        color: Color(0xFF17212B),
      ),
      dataModuleStyle: const QrDataModuleStyle(
        dataModuleShape: QrDataModuleShape.square,
        color: Color(0xFF17212B),
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String title,
    required String subtitle,
    bool highlightSubtitle = false,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: const Color(0xFF0F7A4D)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: highlightSubtitle
                      ? FontWeight.bold
                      : FontWeight.w600,
                  color: highlightSubtitle
                      ? const Color(0xFF17212B)
                      : const Color(0xFF17212B),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CarnetPhoto extends StatelessWidget {
  const _CarnetPhoto({required this.user});

  final User? user;

  @override
  Widget build(BuildContext context) {
    return AuthenticatedProfilePhoto(
      userId: user?.id ?? 0,
      hasPhoto: user?.photoProfile?.isNotEmpty == true,
      radius: 45,
      backgroundColor: const Color(0xFF17212B).withValues(alpha: 0.1),
      placeholder: const Icon(
        Icons.person,
        size: 55,
        color: Color(0xFF17212B),
      ),
    );
  }
}

class _CarnetEmptyState extends StatelessWidget {
  const _CarnetEmptyState({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 58, color: const Color(0xFF17212B)),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF17212B),
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade700, height: 1.4),
            ),
            const SizedBox(height: 20),
            if (actionLabel == 'Reintentar')
              OutlinedButton.icon(
                onPressed: onAction,
                icon: const Icon(Icons.refresh),
                label: Text(actionLabel),
              )
            else
              FilledButton.icon(
                onPressed: onAction,
                icon: const Icon(Icons.refresh),
                label: Text(actionLabel),
              ),
          ],
        ),
      ),
    );
  }
}
