import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'providers/global_loading_provider.dart';
import 'providers/instructor_provider.dart';
import 'core/theme/app_theme.dart';
import 'screens/access_history_screen.dart';
import 'screens/attendance_screen.dart';
import 'screens/carnet_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/profile_screen.dart';
import 'widgets/sena_loading.dart';
import 'dart:io';

void main() {

  HttpOverrides.global = MyHttpOverrides();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => InstructorProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => LoadingProvider(),
      child: MaterialApp(
        title: 'SENA - Carnet Digital',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const AuthGate(),
        routes: {
          '/login': (context) => const LoginScreen(),
          '/home': (context) => const HomeScreen(),
          '/carnet': (context) => const CarnetScreen(),
          '/attendance': (context) => const AttendanceScreen(),
          '/access-history': (context) => const AccessHistoryScreen(),
          '/profile': (context) => const ProfileScreen(),
          '/loading': (context) => const SenaLoadingScreen(),
        },
        // 2. Agregamos el builder para que el Overlay cubra TODAS las pantallas automáticamente
        builder: (context, child) {
          return Consumer<LoadingProvider>(
            builder: (context, loadingProvider, _) {
              return SenaLoadingOverlay(
                visible: loadingProvider.isLoading,
                message: loadingProvider.message,
                child: child ?? const SizedBox.shrink(),
              );
            },
          );
        },
      ),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _checkingSession = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _restoreSession();
    });
  }

  Future<void> _restoreSession() async {
    await context.read<AuthProvider>().checkAuthStatus();
    if (mounted) setState(() => _checkingSession = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_checkingSession) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return context.watch<AuthProvider>().user == null
        ? const LoginScreen()
        : const HomeScreen();
  }
}


class MyHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback =
          (X509Certificate cert, String host, int port) => true;
  }
}
