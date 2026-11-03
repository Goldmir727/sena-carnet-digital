import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme/app_theme.dart';
import '../core/utils/dialog_utils.dart';
import '../providers/auth_provider.dart';
import '../providers/global_loading_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final loadingProvider = Provider.of<LoadingProvider>(
      context,
      listen: false,
    );
    loadingProvider.show('Verificando credenciales');

    // Llamada al AuthProvider que internamente usa AuthService
    final success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text,
    );

    if (!mounted) return;
    setState(() => _isLoading = false);
    loadingProvider.hide();

    if (success && mounted) {
      // Redirigir a la pantalla principal o al carnet
      Navigator.pushReplacementNamed(context, '/home');
    } else if (authProvider.pendingPreauthToken != null && mounted) {
      final verified = await _showTwoFactorDialog();
      if (verified && mounted) {
        Navigator.pushReplacementNamed(context, '/home');
      }
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            authProvider.errorMessage ?? 'Credenciales incorrectas',
          ),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<bool> _showTwoFactorDialog() async {
    final codeController = TextEditingController();
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    var verifying = false;

    final authenticated = await showDialogAndWaitForTransition<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final VoidCallback? onSubmit = verifying
                ? null
                : () async {
                    final code = codeController.text.trim();
                    if (!authProvider.twoFactorVerified && code.length != 6) {
                      return;
                    }
                    setDialogState(() => verifying = true);
                    final loadingProvider = Provider.of<LoadingProvider>(
                      context,
                      listen: false,
                    );
                    loadingProvider.show('Validando código');
                    final verified = authProvider.twoFactorVerified
                        ? await authProvider.retryAuthenticatedProfile()
                        : await authProvider.verifyTwoFactor(code);
                    loadingProvider.hide();
                    if (!dialogContext.mounted) return;
                    if (verified) {
                      Navigator.of(dialogContext).pop(true);
                    } else {
                      setDialogState(() => verifying = false);
                      ScaffoldMessenger.of(dialogContext).showSnackBar(
                        SnackBar(
                          content: Text(
                            authProvider.errorMessage ?? 'Código inválido.',
                          ),
                          backgroundColor: Colors.red,
                        ),
                      );
                    }
                  };

            final submitButton = authProvider.twoFactorVerified
                ? OutlinedButton.icon(
                    onPressed: onSubmit,
                    icon: verifying
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh),
                    label: const Text('Reintentar perfil'),
                  )
                : FilledButton(
                    onPressed: onSubmit,
                    child: verifying
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Verificar'),
                  );

            return AlertDialog(
              title: const Text('Verificación en dos pasos'),
              content: authProvider.twoFactorVerified
                  ? const Text(
                      'El código fue validado. Reintenta cargar tu perfil para continuar.',
                    )
                  : TextField(
                      controller: codeController,
                      autofocus: true,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: const InputDecoration(
                        labelText: 'Código enviado a tu correo',
                        prefixIcon: Icon(Icons.verified_outlined),
                      ),
                    ),
              actions: [
                TextButton(
                  onPressed: verifying
                      ? null
                      : () => Navigator.of(dialogContext).pop(false),
                  child: const Text('Cancelar'),
                ),
                submitButton,
              ],
            );
          },
        );
      },
    );
    codeController.dispose();
    return authenticated ?? false;
  }

  Future<void> _showPasswordResetDialog() async {
    final authProvider = context.read<AuthProvider>();
    final loadingProvider = context.read<LoadingProvider>();
    final emailController = TextEditingController(
      text: _emailController.text.trim(),
    );
    final tokenController = TextEditingController();
    final newPasswordController = TextEditingController();
    var instructionsSent = false;
    var submitting = false;
    String? message;

    final didReset = await showDialogAndWaitForTransition<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Recuperar contraseña'),
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
                    decoration: const InputDecoration(
                      labelText: 'Correo institucional',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                  ),
                  if (instructionsSent) ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: tokenController,
                      minLines: 2,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Código recibido por correo',
                        prefixIcon: Icon(Icons.key_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: newPasswordController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Nueva contraseña',
                        helperText: 'Mínimo 6 caracteres',
                        prefixIcon: Icon(Icons.lock_outline),
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
              onPressed: submitting
                  ? null
                  : () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: submitting
                  ? null
                  : () async {
                      final email = emailController.text.trim();
                      final token = tokenController.text.trim();
                      final password = newPasswordController.text;
                      if (!email.contains('@') ||
                          (instructionsSent &&
                              (token.isEmpty || password.length < 6))) {
                        setDialogState(() {
                          message = instructionsSent
                              ? 'Ingresa el código recibido y una contraseña de al menos 6 caracteres.'
                              : 'Ingresa un correo válido.';
                        });
                        return;
                      }

                      setDialogState(() {
                        submitting = true;
                        message = null;
                      });
                      loadingProvider.show(
                        instructionsSent
                            ? 'Actualizando contraseña'
                            : 'Enviando correo',
                      );
                      final result = instructionsSent
                          ? await authProvider.resetPassword(
                              token: token,
                              newPassword: password,
                            )
                          : await authProvider.requestPasswordReset(email);
                      loadingProvider.hide();
                      if (!dialogContext.mounted) return;

                      if (result['success'] == true && instructionsSent) {
                        Navigator.of(dialogContext).pop(true);
                        return;
                      }

                      setDialogState(() {
                        submitting = false;
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
              child: submitting
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
    newPasswordController.dispose();
    if (didReset == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Contraseña actualizada correctamente.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.authBackground,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28.0),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Logo o Título SENA
                const Icon(
                  Icons.badge_outlined,
                  size: 80,
                  color: Color(0xFF0F7A4D),
                ),
                const SizedBox(height: 16),
                const Text(
                  'SENA Carnet Digital',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF17212B),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Ingresa tus credenciales para acceder',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 36),

                // Campo Correo / Documento
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: 'Correo Institucional',
                    prefixIcon: const Icon(Icons.email_outlined),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Por favor ingresa tu correo';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 18),

                // Campo Contraseña
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Contraseña',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off
                            : Icons.visibility,
                      ),
                      onPressed: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Por favor ingresa tu contraseña';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 28),

                // Botón Iniciar Sesión
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F7A4D),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'INICIAR SESIÓN',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: _isLoading ? null : _showPasswordResetDialog,
                    child: const Text(
                      'Olvidé mi contraseña',
                      style: TextStyle(color: Color(0xFF17212B)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
