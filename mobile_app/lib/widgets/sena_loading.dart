import 'dart:math' as math;

import 'package:flutter/material.dart';

class SenaLoadingMark extends StatefulWidget {
  const SenaLoadingMark({super.key, this.size = 112});

  final double size;

  @override
  State<SenaLoadingMark> createState() => _SenaLoadingMarkState();
}

class _SenaLoadingMarkState extends State<SenaLoadingMark>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final angle = _controller.value * math.pi * 2;

        // Determina la cara visible (front / back)
        final isFrontFace = math.cos(angle) >= 0;

        final faceColor = isFrontFace ? const Color(0xFF0F7A4D) : Colors.white;
        final textColor = isFrontFace ? Colors.white : const Color(0xFF0F7A4D);

        // Evita colapso total en 90° y 270°
        final scaleX = math.cos(angle).abs().clamp(0.08, 1.0);

        return Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.0015)
            ..rotateY(angle),
          child: Transform.scale(
            scaleX: scaleX,
            child: Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                color: faceColor,
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFF0F7A4D), width: 5),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF17212B).withValues(alpha: 0.16),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              alignment: Alignment.center,
              // Corrige la lectura en espejo del texto en la cara posterior
              child: Transform(
                alignment: Alignment.center,
                transform: Matrix4.identity()
                  ..rotateY(isFrontFace ? 0 : math.pi),
                child: Text(
                  'SENA',
                  style: TextStyle(
                    color: textColor,
                    fontSize: widget.size * 0.22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class SenaLoadingScreen extends StatelessWidget {
  const SenaLoadingScreen({super.key, this.message = 'Cargando'});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F6F4),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SenaLoadingMark(),
            const SizedBox(height: 26),
            Text(
              message,
              style: const TextStyle(
                color: Color(0xFF17212B),
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            const SizedBox(
              width: 120,
              child: LinearProgressIndicator(
                minHeight: 4,
                color: Color(0xFF0F7A4D),
                backgroundColor: Color(0xFFCDE8DA),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SenaLoadingOverlay extends StatelessWidget {
  const SenaLoadingOverlay({
    required this.visible,
    required this.child,
    super.key,
    this.message = 'Cargando',
  });

  final bool visible;
  final Widget child;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        if (visible)
          Positioned.fill(
            child: ColoredBox(
              color: Colors.white70,
              child: Center(
                child: Material(
                  color: Colors.white,
                  elevation: 8,
                  borderRadius: BorderRadius.circular(18),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 28,
                      vertical: 24,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SenaLoadingMark(size: 82),
                        const SizedBox(height: 14),
                        Text(
                          message,
                          style: const TextStyle(
                            color: Color(0xFF17212B),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
