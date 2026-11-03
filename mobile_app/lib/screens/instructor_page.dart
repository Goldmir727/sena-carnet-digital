import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/training_group.dart';
import '../providers/instructor_provider.dart';
import 'qr_asistencia_page.dart';
import 'registro_asistencia_page.dart';

class InstructorPage extends StatefulWidget {
  const InstructorPage({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<InstructorPage> createState() => _InstructorPageState();
}

class _InstructorPageState extends State<InstructorPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<InstructorProvider>().loadGroups();
    });
  }

  void _openQr(BuildContext context, TrainingGroup group) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) =>
            GenerarQrPage(initialGroup: group, activity: 'Sesión de formación'),
      ),
    );
  }

  void _openRecords(BuildContext context, TrainingGroup group) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => RegistrosAsistenciaPage(grupoId: group.id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InstructorProvider>();
    final selectedGroup = provider.selectedGroup;

    return Scaffold(
      appBar: widget.embedded
          ? null
          : AppBar(
              title: const Text(
                'Panel del Instructor',
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
                        'Gestión de asistencias',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Selecciona uno de tus grupos asignados para gestionar la asistencia.',
                        style: TextStyle(fontSize: 16, color: Colors.grey),
                      ),
                      const SizedBox(height: 24),
                      if (provider.errorMessage != null)
                        _ErrorBanner(
                          message: provider.errorMessage!,
                          onRetry: () => provider.loadGroups(force: true),
                        ),
                      if (provider.groups.isEmpty &&
                          provider.errorMessage == null)
                        const _EmptyGroups(),
                      if (provider.groups.isNotEmpty) ...[
                        DropdownButtonFormField<TrainingGroup>(
                          initialValue: selectedGroup,
                          decoration: const InputDecoration(
                            labelText: 'Grupo de formación',
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
                          onChanged: provider.selectGroup,
                        ),
                        const SizedBox(height: 24),
                        _ActionCard(
                          icon: Icons.qr_code_2,
                          title: 'Generar código QR',
                          description: 'Crea una sesión para que los aprendices registren su asistencia.',
                          label: 'Generar QR',
                          onPressed: selectedGroup == null
                              ? null
                              : () => _openQr(context, selectedGroup),
                        ),
                        const SizedBox(height: 20),
                        _ActionCard(
                          icon: Icons.assignment_outlined,
                          title: 'Registros de asistencia',
                          description: 'Consulta qué aprendices registraron asistencia en el grupo seleccionado.',
                          label: 'Ver asistencias',
                          outlined: true,
                          onPressed: selectedGroup == null
                              ? null
                              : () => _openRecords(context, selectedGroup),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.label,
    required this.onPressed,
    this.outlined = false,
  });

  final IconData icon;
  final String title;
  final String description;
  final String label;
  final VoidCallback? onPressed;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 52),
            const SizedBox(height: 15),
            Text(
              title,
              style: const TextStyle(fontSize: 21, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              description,
              style: const TextStyle(fontSize: 15, height: 1.4),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: outlined
                  ? OutlinedButton.icon(
                      onPressed: onPressed,
                      icon: const Icon(Icons.list_alt),
                      label: Text(label),
                    )
                  : ElevatedButton.icon(
                      onPressed: onPressed,
                      icon: const Icon(Icons.qr_code),
                      label: Text(label),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});

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

class _EmptyGroups extends StatelessWidget {
  const _EmptyGroups();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Text(
          'Aún no tienes grupos asignados. Si crees que es un error, comunícate con coordinación.',
        ),
      ),
    );
  }
}
