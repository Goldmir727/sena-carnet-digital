import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/training_group.dart';
import '../providers/instructor_provider.dart';
import 'generar_qr_page.dart';

class GenerarQrPage extends StatefulWidget {
  const GenerarQrPage({super.key, this.initialGroup, required this.activity});

  final TrainingGroup? initialGroup;
  final String activity;

  @override
  State<GenerarQrPage> createState() => _GenerarQrPageState();
}

class _GenerarQrPageState extends State<GenerarQrPage> {
  TrainingGroup? selectedGroup;

  @override
  void initState() {
    super.initState();
    selectedGroup = widget.initialGroup;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<InstructorProvider>();
      selectedGroup ??= provider.selectedGroup;
      provider.loadGroups();
      if (mounted) setState(() {});
    });
  }

  void _openQr() {
    final group = selectedGroup;
    if (group == null) return;

    context.read<InstructorProvider>().selectGroup(group);
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) =>
            QrAsistenciaPage(group: group, activity: widget.activity),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InstructorProvider>();
    final selectedValue =
        selectedGroup != null &&
            provider.groups.any((group) => group.id == selectedGroup!.id)
        ? selectedGroup
        : null;
    final canGenerate = selectedValue != null;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Generar asistencia',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: provider.isLoading && provider.groups.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: () => provider.loadGroups(force: true),
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Nueva sesión de asistencia',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Selecciona uno de tus grupos asignados para crear el código QR de asistencia.',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.grey,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 30),
                      if (provider.errorMessage != null)
                        _ErrorMessage(
                          message: provider.errorMessage!,
                          onRetry: () => provider.loadGroups(force: true),
                        ),
                      if (provider.groups.isNotEmpty)
                        DropdownButtonFormField<TrainingGroup>(
                          initialValue: selectedValue,
                          decoration: const InputDecoration(
                            labelText: 'Ficha o grupo',
                            prefixIcon: Icon(Icons.groups_outlined),
                            border: OutlineInputBorder(),
                          ),
                          items: provider.groups
                              .map(
                                (group) => DropdownMenuItem(
                                  value: group,
                                  child: Text(group.name),
                                ),
                              )
                              .toList(),
                          onChanged: (group) {
                            setState(() => selectedGroup = group);
                            provider.selectGroup(group);
                          },
                        )
                      else if (provider.errorMessage == null)
                        const Text(
                          'Aún no tienes grupos asignados. Si crees que es un error, comunícate con coordinación.',
                        ),
                      const SizedBox(height: 25),
                      Card(
                        child: ListTile(
                          leading: const Icon(Icons.school_outlined),
                          title: const Text('Actividad'),
                          subtitle: Text(widget.activity),
                        ),
                      ),
                      const SizedBox(height: 35),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: canGenerate ? _openQr : null,
                          icon: const Icon(Icons.qr_code_2),
                          label: const Text('Generar código QR'),
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 25),
                      const _InfoMessage(),
                    ],
                  ),
                ),
              ),
      ),
    );
  }
}

class _InfoMessage extends StatelessWidget {
  const _InfoMessage();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: Colors.grey.shade100,
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline, size: 24),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Comparte el código con los aprendices del grupo para que registren su asistencia.',
              style: TextStyle(fontSize: 14, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorMessage extends StatelessWidget {
  const _ErrorMessage({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.red.shade50,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.error_outline, color: Colors.red),
              title: Text(message),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Reintentar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
