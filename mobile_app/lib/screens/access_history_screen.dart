import 'package:flutter/material.dart';

import '../models/access_record.dart';
import '../services/access_history_service.dart';

class AccessHistoryScreen extends StatefulWidget {
  const AccessHistoryScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<AccessHistoryScreen> createState() => _AccessHistoryScreenState();
}

class _AccessHistoryScreenState extends State<AccessHistoryScreen> {
  final AccessHistoryService _service = AccessHistoryService();
  List<AccessRecord> _records = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final records = await _service.getMine();
      if (!mounted) return;
      setState(() {
        _records = records;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'No se pudo cargar el historial de accesos.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.embedded
          ? null
          : AppBar(
              title: const Text('Historial de accesos'),
              backgroundColor: const Color(0xFF0A5A39),
              foregroundColor: Colors.white,
              actions: [
                IconButton(
                  tooltip: 'Actualizar',
                  onPressed: _loading ? null : _loadHistory,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
      backgroundColor: const Color(0xFFF3F6F4),
      body: Column(
        children: [
          if (widget.embedded)
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 14, 4),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Historial de accesos',
                      style: TextStyle(
                        color: Color(0xFF17212B),
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Actualizar',
                    onPressed: _loading ? null : _loadHistory,
                    icon: const Icon(Icons.refresh, color: Color(0xFF17212B)),
                  ),
                ],
              ),
            ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF0F7A4D)),
      );
    }

    if (_error != null) {
      return _MessageState(
        icon: Icons.cloud_off_outlined,
        message: _error!,
        actionLabel: 'Reintentar',
        onAction: _loadHistory,
      );
    }

    if (_records.isEmpty) {
      return const _MessageState(
        icon: Icons.history_toggle_off,
        message: 'Aún no tienes registros de acceso.',
      );
    }

    return RefreshIndicator(
      color: const Color(0xFF0F7A4D),
      onRefresh: _loadHistory,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 28),
        itemCount: _records.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) =>
            _AccessRecordTile(record: _records[index]),
      ),
    );
  }
}

class _AccessRecordTile extends StatelessWidget {
  const _AccessRecordTile({required this.record});

  final AccessRecord record;

  @override
  Widget build(BuildContext context) {
    final isEntry = record.movement.toLowerCase() == 'entrada';
    final accent = isEntry ? const Color(0xFF0F7A4D) : const Color(0xFF0A5A39);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF17212B).withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isEntry ? Icons.login_rounded : Icons.logout_rounded,
              color: accent,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  record.movement,
                  style: TextStyle(color: accent, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 5),
                Text(
                  record.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF17212B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${record.day}  ·  ${record.time}',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Colors.grey),
        ],
      ),
    );
  }
}

class _MessageState extends StatelessWidget {
  const _MessageState({
    required this.icon,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 52, color: const Color(0xFF17212B)),
            const SizedBox(height: 14),
            Text(message, textAlign: TextAlign.center),
            if (actionLabel != null) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onAction,
                icon: const Icon(Icons.refresh),
                label: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
