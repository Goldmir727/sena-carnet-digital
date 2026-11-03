import 'package:flutter/material.dart';
import 'package:file_selector/file_selector.dart';
import 'package:provider/provider.dart';

import '../core/utils/dialog_utils.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../providers/global_loading_provider.dart';
import '../widgets/authenticated_profile_photo.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _documentController = TextEditingController();

  bool _editing = false;
  String _documentType = 'CC';
  String _sex = 'No especificado';
  String _bloodType = 'No especificado';

  Future<void> _pickPhoto(AuthProvider authProvider) async {
    try {
      const imageTypeGroup = XTypeGroup(
        label: 'Imágenes',
        extensions: <String>['jpg', 'jpeg', 'png', 'webp'],
      );
      final image = await openFile(
        acceptedTypeGroups: <XTypeGroup>[imageTypeGroup],
      );
      if (image == null || !mounted) return;

      final loadingProvider = context.read<LoadingProvider>();
      loadingProvider.show('Actualizando fotografía');
      final success = await authProvider.updateProfilePhoto(image);
      loadingProvider.hide();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success
                ? 'Fotografía actualizada correctamente.'
                : authProvider.errorMessage ??
                      'No se pudo actualizar la fotografía.',
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudo abrir la galería. Inténtalo de nuevo.'),
        ),
      );
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _documentController.dispose();
    super.dispose();
  }

  void _loadUser(UserSnapshot user) {
    _firstNameController.text = user.firstName;
    _lastNameController.text = user.lastName;
    _emailController.text = user.email;
    _documentController.text = user.documentNumber;
    _documentType = user.documentType.isEmpty ? 'CC' : user.documentType;
    _sex = user.sex.isEmpty ? 'No especificado' : user.sex;
    _bloodType = user.bloodType.isEmpty ? 'No especificado' : user.bloodType;
  }

  Future<void> _saveProfile(AuthProvider authProvider) async {
    if (!_formKey.currentState!.validate()) return;

    final loadingProvider = context.read<LoadingProvider>();
    loadingProvider.show('Guardando perfil');
    final success = await authProvider.updateProfile({
      'nombres': _firstNameController.text.trim(),
      'apellidos': _lastNameController.text.trim(),
      'email': _emailController.text.trim(),
      'tipo_documento': _documentType,
      'numero_documento': _documentController.text.trim(),
      'sexo': _sex == 'No especificado' ? null : _sex,
      'tipo_sangre': _bloodType == 'No especificado' ? null : _bloodType,
    });
    loadingProvider.hide();

    if (!mounted) return;
    if (success) {
      setState(() => _editing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Perfil actualizado correctamente.')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            authProvider.errorMessage ?? 'No se pudo actualizar el perfil.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final user = authProvider.user;

    if (user == null) {
      return const Center(child: Text('Inicia sesión para ver tu perfil.'));
    }

    if (!_editing && _firstNameController.text.isEmpty) {
      _loadUser(UserSnapshot.fromUser(user));
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 28),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                _ProfileAvatar(user: user, radius: 38),
                Positioned(
                  right: -4,
                  bottom: -4,
                  child: Material(
                    color: const Color(0xFF0F7A4D),
                    shape: const CircleBorder(),
                    elevation: 3,
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: authProvider.isLoading
                          ? null
                          : () => _pickPhoto(authProvider),
                      child: const Padding(
                        padding: EdgeInsets.all(8),
                        child: Icon(
                          Icons.camera_alt_outlined,
                          size: 17,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    user.fullName,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    user.role,
                    style: TextStyle(color: Colors.grey.shade700),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: _editing ? 'Cancelar edición' : 'Editar perfil',
              icon: Icon(_editing ? Icons.close : Icons.edit_outlined),
              onPressed: () => setState(() => _editing = !_editing),
            ),
          ],
        ),
        const SizedBox(height: 28),
        if (_editing) _buildEditForm(authProvider) else _buildDetails(user),
        const SizedBox(height: 18),
        _buildProfileActions(authProvider),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildDetails(User user) {
    return Column(
      children: [
        _detailTile(Icons.person_outline, 'Nombre', user.fullName),
        _detailTile(Icons.email_outlined, 'Correo', user.email),
        _detailTile(
          Icons.badge_outlined,
          'Documento',
          '${user.documentType} ${user.documentNumber}'.trim(),
        ),
        _detailTile(
          Icons.wc_outlined,
          'Sexo',
          user.sex.isEmpty ? 'No especificado' : user.sex,
        ),
        _detailTile(
          Icons.bloodtype_outlined,
          'Tipo de sangre',
          user.bloodType.isEmpty ? 'No registrado' : user.bloodType,
        ),
        _detailTile(
          Icons.verified_user_outlined,
          'Estado',
          user.isActive ? 'Activo' : 'Inactivo',
          valueBadge: true,
          isActive: user.isActive,
        ),
      ],
    );
  }

  Widget _detailTile(
    IconData icon,
    String title,
    String value, {
    bool valueBadge = false,
    bool isActive = false,
  }) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F9F8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xFF17212B)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: Colors.grey.shade700,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                valueBadge
                    ? Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: isActive
                              ? const Color(0xFFE8F5EE)
                              : Colors.red.shade100,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          value,
                          style: TextStyle(
                            color: isActive
                                ? const Color(0xFF0A5A39)
                                : Colors.red.shade800,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      )
                    : Text(
                        value.isEmpty ? 'No registrado' : value,
                        style: const TextStyle(
                          color: Color(0xFF17212B),
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileActions(AuthProvider authProvider) {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: authProvider.isLoading
                ? null
                : () => _showPasswordResetDialog(authProvider),
            icon: const Icon(Icons.lock_reset_outlined),
            label: const Text('Cambiar contraseña'),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF17212B),
              minimumSize: const Size.fromHeight(48),
            ),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: TextButton.icon(
            onPressed: authProvider.isLoading
                ? null
                : () => _confirmLogout(authProvider),
            icon: const Icon(Icons.logout_outlined),
            label: const Text('Cerrar sesión'),
            style: TextButton.styleFrom(
              foregroundColor: Colors.red.shade700,
              minimumSize: const Size.fromHeight(44),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _showPasswordResetDialog(AuthProvider authProvider) async {
    final emailController = TextEditingController(
      text: authProvider.user?.email ?? '',
    );
    final tokenController = TextEditingController();
    final passwordController = TextEditingController();
    var instructionsSent = false;
    var isSubmitting = false;
    String? message;

    final didReset = await showDialogAndWaitForTransition<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Cambiar contraseña'),
          content: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: emailController,
                    enabled: !instructionsSent,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Correo'),
                  ),
                  if (instructionsSent) ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: tokenController,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Código recibido por correo',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Nueva contraseña',
                        helperText: 'Mínimo 6 caracteres',
                      ),
                    ),
                  ],
                  if (message != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      message!,
                      style: TextStyle(color: Colors.grey.shade700),
                    ),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: isSubmitting
                  ? null
                  : () => Navigator.pop(dialogContext),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      final email = emailController.text.trim();
                      if (email.isEmpty ||
                          (instructionsSent &&
                              (tokenController.text.trim().isEmpty ||
                                  passwordController.text.length < 6))) {
                        setDialogState(() {
                          message = instructionsSent
                              ? 'Ingresa el código recibido y una contraseña de al menos 6 caracteres.'
                              : 'Ingresa tu correo.';
                        });
                        return;
                      }

                      setDialogState(() {
                        isSubmitting = true;
                        message = null;
                      });
                      final result = instructionsSent
                          ? await authProvider.resetPassword(
                              token: tokenController.text.trim(),
                              newPassword: passwordController.text,
                            )
                          : await authProvider.requestPasswordReset(email);
                      if (!dialogContext.mounted) return;

                      if (result['success'] == true && instructionsSent) {
                        Navigator.pop(dialogContext, true);
                        return;
                      }

                      setDialogState(() {
                        isSubmitting = false;
                        if (result['success'] == true) {
                          instructionsSent = true;
                          message =
                              'Revisa tu correo e ingresa el código recibido.';
                        } else {
                          message =
                              result['message'] as String? ??
                              'No se pudo completar la solicitud.';
                        }
                      });
                    },
              child: isSubmitting
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      instructionsSent
                          ? 'Guardar contraseña'
                          : 'Enviar código de recuperación',
                    ),
            ),
          ],
        ),
      ),
    );

    emailController.dispose();
    tokenController.dispose();
    passwordController.dispose();
    if (didReset == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Contraseña actualizada correctamente.')),
      );
    }
  }

  Future<void> _confirmLogout(AuthProvider authProvider) async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Deseas cerrar tu sesión actual?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
    if (shouldLogout != true || !mounted) return;
    await authProvider.logout();
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
  }

  Widget _buildEditForm(AuthProvider authProvider) {
    return Form(
      key: _formKey,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              _field(_firstNameController, 'Nombres', Icons.person_outline),
              _field(_lastNameController, 'Apellidos', Icons.person_outline),
              _field(
                _emailController,
                'Correo',
                Icons.email_outlined,
                keyboardType: TextInputType.emailAddress,
              ),
              DropdownButtonFormField<String>(
                initialValue: _documentType,
                decoration: const InputDecoration(
                  labelText: 'Tipo de documento',
                  prefixIcon: Icon(Icons.badge_outlined),
                ),
                items: const ['CC', 'TI', 'CE', 'PPT']
                    .map(
                      (value) =>
                          DropdownMenuItem(value: value, child: Text(value)),
                    )
                    .toList(),
                onChanged: (value) =>
                    setState(() => _documentType = value ?? 'CC'),
              ),
              const SizedBox(height: 12),
              _field(
                _documentController,
                'Número de documento',
                Icons.numbers,
                keyboardType: TextInputType.number,
              ),
              DropdownButtonFormField<String>(
                initialValue: _sex,
                decoration: const InputDecoration(
                  labelText: 'Sexo',
                  prefixIcon: Icon(Icons.wc_outlined),
                ),
                items:
                    const ['No especificado', 'Femenino', 'Masculino', 'Otro']
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text(value),
                          ),
                        )
                        .toList(),
                onChanged: (value) =>
                    setState(() => _sex = value ?? 'No especificado'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _bloodType,
                decoration: const InputDecoration(
                  labelText: 'Tipo de sangre',
                  prefixIcon: Icon(Icons.bloodtype_outlined),
                ),
                items:
                    const [
                          'No especificado',
                          'O+',
                          'O-',
                          'A+',
                          'A-',
                          'B+',
                          'B-',
                          'AB+',
                          'AB-',
                        ]
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text(value),
                          ),
                        )
                        .toList(),
                onChanged: (value) =>
                    setState(() => _bloodType = value ?? 'No especificado'),
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: authProvider.isLoading
                    ? null
                    : () => _saveProfile(authProvider),
                icon: authProvider.isLoading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.save_outlined),
                label: const Text('Guardar cambios'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0F7A4D),
                  minimumSize: const Size.fromHeight(48),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    IconData icon, {
    TextInputType? keyboardType,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
        validator: (value) =>
            value == null || value.trim().isEmpty ? 'Campo obligatorio' : null,
      ),
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.user, required this.radius});

  final User user;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final initials =
        '${user.firstName.isNotEmpty ? user.firstName[0] : ''}${user.lastName.isNotEmpty ? user.lastName[0] : ''}'
            .toUpperCase();

    return AuthenticatedProfilePhoto(
      userId: user.id,
      hasPhoto: user.photoProfile?.isNotEmpty == true,
      radius: radius,
      backgroundColor: const Color(0xFF0F7A4D),
      placeholder: Text(
        initials,
        style: TextStyle(
          color: Colors.white,
          fontSize: radius * 0.65,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class UserSnapshot {
  const UserSnapshot({
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.documentNumber,
    required this.documentType,
    required this.sex,
    required this.bloodType,
  });

  factory UserSnapshot.fromUser(User user) => UserSnapshot(
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    documentNumber: user.documentNumber,
    documentType: user.documentType,
    sex: user.sex,
    bloodType: user.bloodType,
  );

  final String firstName;
  final String lastName;
  final String email;
  final String documentNumber;
  final String documentType;
  final String sex;
  final String bloodType;
}
