import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../services/event_service.dart';

class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  static const _customEventValue = '__custom_event__';

  final _service = EventService();
  final _customNameController = TextEditingController();
  String? _selectedName;
  List<String> _savedNames = const [];
  List<EventQr> _activeEvents = const [];
  bool _isLoading = true;
  bool _isCreating = false;
  String? _errorMessage;

  bool get _isCustomName => _selectedName == _customEventValue;

  @override
  void initState() {
    super.initState();
    _loadEvents();
  }

  @override
  void dispose() {
    _customNameController.dispose();
    super.dispose();
  }

  Future<void> _loadEvents() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final results = await Future.wait([
        _service.getSavedNames(),
        _service.getActiveEvents(),
      ]);
      if (!mounted) return;
      setState(() {
        _savedNames = results[0] as List<String>;
        _activeEvents = results[1] as List<EventQr>;
      });
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _errorMessage = error.toString().replaceFirst('Exception: ', ''),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _createEvent() async {
    final name = (_isCustomName ? _customNameController.text : _selectedName)
        ?.trim();
    if (name == null || name.isEmpty) {
      setState(
        () => _errorMessage = 'Selecciona o escribe el nombre del evento.',
      );
      return;
    }

    setState(() {
      _isCreating = true;
      _errorMessage = null;
    });
    try {
      final event = await _service.createEvent(name);
      if (!mounted) return;
      await _openEvent(event);
    } catch (error) {
      if (mounted) {
        setState(
          () =>
              _errorMessage = error.toString().replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _isCreating = false);
    }
  }

  Future<void> _openEvent(EventQr event) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => EventQrScreen(event: event, service: _service),
      ),
    );
    if (mounted) await _loadEvents();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.embedded
          ? null
          : AppBar(
              title: const Text('Eventos'),
              backgroundColor: const Color(0xFF0A5A39),
              foregroundColor: Colors.white,
            ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadEvents,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  const Text(
                    'Asistencia a eventos',
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Crea un QR abierto a usuarios de cualquier centro. La asistencia permanece activa durante 24 horas o hasta que la cierres.',
                    style: TextStyle(color: Colors.grey, height: 1.4),
                  ),
                  const SizedBox(height: 24),
                  if (_errorMessage != null) ...[
                    _ErrorCard(message: _errorMessage!),
                    const SizedBox(height: 16),
                  ],
                  DropdownButtonFormField<String>(
                    initialValue: _selectedName,
                    decoration: const InputDecoration(
                      labelText: 'Evento guardado',
                      prefixIcon: Icon(Icons.event_outlined),
                      border: OutlineInputBorder(),
                    ),
                    hint: const Text('Selecciona un evento'),
                    items: [
                      ..._savedNames
                          .where((name) => name != _customEventValue)
                          .map(
                            (name) => DropdownMenuItem(
                              value: name,
                              child: Text(name),
                            ),
                          ),
                      const DropdownMenuItem(
                        value: _customEventValue,
                        child: Text('Escribir un evento nuevo'),
                      ),
                    ],
                    onChanged: (value) => setState(() {
                      _selectedName = value;
                      _errorMessage = null;
                    }),
                  ),
                  if (_isCustomName) ...[
                    const SizedBox(height: 14),
                    TextField(
                      controller: _customNameController,
                      maxLength: 200,
                      decoration: const InputDecoration(
                        labelText: 'Nombre del evento',
                        prefixIcon: Icon(Icons.edit_calendar_outlined),
                        border: OutlineInputBorder(),
                      ),
                      onChanged: (_) {
                        if (_errorMessage != null) {
                          setState(() => _errorMessage = null);
                        }
                      },
                    ),
                  ],
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _isCreating ? null : _createEvent,
                    icon: _isCreating
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.qr_code_2),
                    label: const Text('Crear QR del evento'),
                  ),
                  const SizedBox(height: 30),
                  if (_activeEvents.isNotEmpty) ...[
                    const Text(
                      'Eventos activos',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final event in _activeEvents)
                      Card(
                        child: ListTile(
                          leading: const Icon(Icons.qr_code_2),
                          title: Text(event.name),
                          subtitle: Text(
                            'Vence ${_formatDate(event.expiresAt)}',
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => _openEvent(event),
                        ),
                      ),
                  ],
                ],
              ),
            ),
    );
  }
}

class EventQrScreen extends StatefulWidget {
  const EventQrScreen({super.key, required this.event, required this.service});

  final EventQr event;
  final EventService service;

  @override
  State<EventQrScreen> createState() => _EventQrScreenState();
}

class _EventQrScreenState extends State<EventQrScreen> {
  Timer? _timer;
  Duration _remaining = Duration.zero;
  bool _isClosing = false;

  @override
  void initState() {
    super.initState();
    _updateRemaining();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(_updateRemaining);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _updateRemaining() {
    final remaining = widget.event.expiresAt.difference(DateTime.now());
    _remaining = remaining.isNegative ? Duration.zero : remaining;
  }

  Future<void> _closeEvent() async {
    final shouldClose = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cerrar evento'),
        content: const Text(
          'Al cerrar el evento, el QR dejará de aceptar asistencias.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cerrar evento'),
          ),
        ],
      ),
    );
    if (shouldClose != true || !mounted) return;

    setState(() => _isClosing = true);
    try {
      await widget.service.closeEvent(widget.event.id);
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isClosing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final expired = _remaining == Duration.zero;
    final hours = _remaining.inHours.toString().padLeft(2, '0');
    final minutes = (_remaining.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (_remaining.inSeconds % 60).toString().padLeft(2, '0');

    return Scaffold(
      appBar: AppBar(
        title: const Text('QR del evento'),
        backgroundColor: const Color(0xFF0A5A39),
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            widget.event.name,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            expired ? 'QR vencido' : 'Activo por $hours:$minutes:$seconds',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: expired ? Colors.red : const Color(0xFF0F7A4D),
              fontSize: 17,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 22),
          Center(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 16,
                  ),
                ],
              ),
              child: QrImageView(
                data: widget.event.qrToken,
                size: 260,
                backgroundColor: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'Vence ${_formatDate(widget.event.expiresAt)}. Cualquier usuario autenticado puede escanear este código, sin importar su centro.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.black54, height: 1.4),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: _isClosing ? null : _closeEvent,
            icon: _isClosing
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.stop_circle_outlined),
            label: const Text('Cerrar evento'),
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
          ),
        ],
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.red.shade50,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Text(message, style: TextStyle(color: Colors.red.shade900)),
      ),
    );
  }
}

String _formatDate(DateTime date) {
  final local = date.toLocal();
  return '${local.day.toString().padLeft(2, '0')}/'
      '${local.month.toString().padLeft(2, '0')}/'
      '${local.year} ${local.hour.toString().padLeft(2, '0')}:'
      '${local.minute.toString().padLeft(2, '0')}';
}
